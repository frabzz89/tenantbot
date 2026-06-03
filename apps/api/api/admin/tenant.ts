import type { VercelRequest, VercelResponse } from '@vercel/node'
import { makeSupabase } from '../../_lib/supabase'
import { handleOptions, setCorsHeaders } from '../../_lib/cors'

// POST /api/admin/tenant
// Crea un tenant dopo la registrazione utente (chiamato dal frontend dopo signup Supabase Auth)
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return
  setCorsHeaders(res)
  if (req.method !== 'POST') return res.status(405).end()

  const { user_id, nome, email } = req.body as {
    user_id?: string
    nome?: string
    email?: string
  }

  if (!user_id || !nome || !email) {
    return res.status(400).json({ error: 'user_id, nome ed email richiesti' })
  }

  try {
    const supabase = makeSupabase()

    // Crea tenant
    const { data: tenant, error: tErr } = await supabase
      .from('tenants')
      .insert({ nome, email_contatto: email })
      .select('id')
      .single()

    if (tErr || !tenant) return res.status(500).json({ error: 'Errore creazione tenant: ' + tErr?.message })

    // Collega utente come admin
    const { error: tuErr } = await supabase
      .from('tenant_users')
      .insert({ tenant_id: tenant.id, user_id, ruolo: 'admin' })

    if (tuErr) return res.status(500).json({ error: 'Errore collegamento utente: ' + tuErr.message })

    return res.status(200).json({ ok: true, tenant_id: tenant.id })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: msg })
  }
}


