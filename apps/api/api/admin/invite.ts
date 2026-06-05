import type { VercelRequest, VercelResponse } from '@vercel/node'
import { makeSupabase } from '../../_lib/supabase'
import { handleOptions, setCorsHeaders } from '../../_lib/cors'

// POST /api/admin/invite
// Body: { tenant_id, email, ruolo? }
//
// Two cases:
//   - New user  → sends a Supabase invite email; user clicks link, signs in, is already in tenant_users
//   - Existing  → adds directly to tenant_users (no email sent — they just log in normally)
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return
  setCorsHeaders(res)
  if (req.method !== 'POST') return res.status(405).end()

  const { tenant_id, email, ruolo = 'membro' } = req.body as {
    tenant_id?: string
    email?: string
    ruolo?: string
  }

  if (!tenant_id || !email) {
    return res.status(400).json({ error: 'tenant_id ed email richiesti' })
  }

  const supabase = makeSupabase()

  try {
    // supabase.auth.admin is available at runtime with service role key but the
    // @supabase/supabase-js TS types don't always expose it — cast to bypass.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authAdmin = (supabase.auth as any).admin

    // ── Try to invite as new user ─────────────────────────────────────────────
    const { data: inviteData, error: inviteErr } = await authAdmin.inviteUserByEmail(email)

    let userId: string
    let isNew = true

    if (inviteErr) {
      // "User already registered" → user exists, find them by listing users
      // Supabase admin SDK has no "get by email" method, so we iterate pages.
      // Teams are tiny (< 20 people) so one page is always enough.
      const { data: listData, error: listErr } = await authAdmin.listUsers({ perPage: 1000 })
      if (listErr) return res.status(500).json({ error: 'Errore ricerca utente: ' + listErr.message })

      const existing = listData?.users?.find((u: { email: string; id: string }) => u.email === email)
      if (!existing) {
        return res.status(500).json({ error: 'Errore invito: ' + inviteErr.message })
      }
      userId = existing.id
      isNew = false
    } else {
      userId = inviteData!.user.id
    }

    // ── Check if already a member ─────────────────────────────────────────────
    const { data: already } = await supabase
      .from('tenant_users')
      .select('id')
      .eq('tenant_id', tenant_id)
      .eq('user_id', userId)
      .maybeSingle()

    if (already) {
      return res.status(409).json({ error: 'Questo utente è già membro del tuo team.' })
    }

    // ── Add to tenant ─────────────────────────────────────────────────────────
    const { error: tuErr } = await supabase
      .from('tenant_users')
      .insert({ tenant_id, user_id: userId, ruolo })

    if (tuErr) return res.status(500).json({ error: 'Errore aggiunta al team: ' + tuErr.message })

    return res.status(200).json({ ok: true, user_id: userId, is_new: isNew })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[invite]', msg)
    return res.status(500).json({ error: msg })
  }
}
