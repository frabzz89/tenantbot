import type { VercelRequest, VercelResponse } from '@vercel/node'
import { makeSupabase } from '../../_lib/supabase'
import { handleOptions, setCorsHeaders } from '../../_lib/cors'

// GET /api/admin/team?tenant_id=X
// Returns team members with their email addresses.
// Uses service role to read auth.users (not accessible via anon key).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return
  setCorsHeaders(res)
  if (req.method !== 'GET') return res.status(405).end()

  const tenant_id = req.query.tenant_id as string
  if (!tenant_id) return res.status(400).json({ error: 'tenant_id richiesto' })

  try {
    const supabase = makeSupabase()

    // 1. Get all members for this tenant
    const { data: members, error } = await supabase
      .from('tenant_users')
      .select('user_id, ruolo, created_at')
      .eq('tenant_id', tenant_id)
      .order('created_at')

    if (error) return res.status(500).json({ error: error.message })

    // 2. Enrich with email from auth.users using Admin API (service role only)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authAdmin = (supabase.auth as any).admin
    const enriched = await Promise.all(
      (members ?? []).map(async (m: { user_id: string; ruolo: string; created_at: string }) => {
        const { data } = await authAdmin.getUserById(m.user_id)
        return {
          user_id: m.user_id,
          email: data?.user?.email ?? '(email non disponibile)',
          ruolo: m.ruolo as 'admin' | 'membro',
          created_at: m.created_at as string,
        }
      })
    )

    return res.status(200).json({ ok: true, members: enriched })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[team]', msg)
    return res.status(500).json({ error: msg })
  }
}
