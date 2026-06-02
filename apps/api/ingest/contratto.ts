import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ingestContratto } from '@tenantbot/core'
import { makeSupabase } from '../_lib/supabase'

export const config = { maxDuration: 60 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const secret = process.env.INGEST_SECRET
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { contratto_id, tenant_id, testo } = req.body as {
    contratto_id?: string
    tenant_id?: string
    testo?: string
  }

  if (!contratto_id) return res.status(400).json({ error: 'contratto_id richiesto' })
  if (!tenant_id) return res.status(400).json({ error: 'tenant_id richiesto' })

  const voyageApiKey = process.env.VOYAGE_API_KEY
  if (!voyageApiKey) return res.status(500).json({ error: 'VOYAGE_API_KEY mancante' })

  try {
    const supabase = makeSupabase()
    const result = await ingestContratto({
      supabase,
      tenantId: tenant_id,
      contrattoId: contratto_id,
      testo: testo ?? '',
      voyageApiKey,
    })

    if (!result.ok) return res.status(400).json({ error: result.error })
    return res.status(200).json({ ok: true, chunks: result.chunks })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ingest-contratto]', msg)
    return res.status(500).json({ error: msg })
  }
}
