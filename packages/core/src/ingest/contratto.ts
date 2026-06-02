import type { SupabaseClient } from '@supabase/supabase-js'
import { voyageEmbed } from '../ai'
import { chunkText } from './chunker'

export async function ingestContratto(opts: {
  supabase: SupabaseClient
  tenantId: string
  contrattoId: string
  testo: string
  voyageApiKey: string
}): Promise<{ ok: true; chunks: number } | { ok: false; error: string }> {
  const { supabase, tenantId, contrattoId, testo, voyageApiKey } = opts

  const { data: contratto, error: cErr } = await supabase
    .from('contratti')
    .select('id')
    .eq('id', contrattoId)
    .eq('tenant_id', tenantId)
    .single()

  if (cErr || !contratto) return { ok: false, error: 'Contratto non trovato' }

  if (!testo || testo.trim().length < 10) {
    return { ok: false, error: 'Testo PDF mancante o troppo corto.' }
  }

  const chunks = chunkText(testo.trim(), 400, 50)
  if (chunks.length === 0) return { ok: false, error: 'Nessun testo estratto dal PDF' }

  const rows: { tenant_id: string; contratto_id: string; chunk_text: string; chunk_index: number; embedding: number[] }[] = []

  for (let i = 0; i < chunks.length; i++) {
    const vec = await voyageEmbed(chunks[i], voyageApiKey)
    if (!vec) continue
    rows.push({ tenant_id: tenantId, contratto_id: contrattoId, chunk_text: chunks[i], chunk_index: i, embedding: vec })
  }

  if (rows.length === 0) return { ok: false, error: 'Nessun embedding generato. Verifica VOYAGE_API_KEY.' }

  await supabase.from('contratti_embeddings').delete().eq('contratto_id', contrattoId).eq('tenant_id', tenantId)
  const { error: insErr } = await supabase.from('contratti_embeddings').insert(rows)
  if (insErr) return { ok: false, error: 'Insert embeddings fallito: ' + insErr.message }

  return { ok: true, chunks: rows.length }
}
