import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ingestKbDocumento } from '@tenantbot/core'
import { makeSupabase } from '../../_lib/supabase'
import { handleOptions, setCorsHeaders } from '../../_lib/cors'

export const config = { maxDuration: 60 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return
  setCorsHeaders(res)
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { documento_id, tenant_id, testo } = req.body as {
    documento_id?: string
    tenant_id?: string
    testo?: string
  }

  if (!documento_id) return res.status(400).json({ error: 'documento_id richiesto' })
  if (!tenant_id) return res.status(400).json({ error: 'tenant_id richiesto' })

  const voyageApiKey = process.env.VOYAGE_API_KEY
  if (!voyageApiKey) return res.status(500).json({ error: 'VOYAGE_API_KEY mancante' })

  try {
    const supabase = makeSupabase()
    const result = await ingestKbDocumento({
      supabase,
      tenantId: tenant_id,
      documentoId: documento_id,
      testo,
      voyageApiKey,
    })

    if (!result.ok) return res.status(400).json({ error: result.error })
    return res.status(200).json({ ok: true, chunks: result.chunks, source: result.source })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ingest-kb]', msg)
    return res.status(500).json({ error: msg })
  }
}
