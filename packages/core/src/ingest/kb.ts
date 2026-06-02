import type { SupabaseClient } from '@supabase/supabase-js'
import { voyageEmbed } from '../ai'
import { chunkText } from './chunker'

export async function ingestKbDocumento(opts: {
  supabase: SupabaseClient
  tenantId: string
  documentoId: string
  testo?: string  // testo estratto da PDF nel browser (opzionale)
  voyageApiKey: string
}): Promise<{ ok: true; chunks: number; source: 'pdf' | 'text' } | { ok: false; error: string }> {
  const { supabase, tenantId, documentoId, voyageApiKey } = opts

  const { data: doc, error: dErr } = await supabase
    .from('kb_documenti')
    .select('id, titolo, contenuto, pdf_storage_path')
    .eq('id', documentoId)
    .eq('tenant_id', tenantId)
    .single()

  if (dErr || !doc) return { ok: false, error: 'Documento non trovato' }

  let fullText = ''
  let source: 'pdf' | 'text' = 'text'

  if (opts.testo && opts.testo.trim().length >= 10) {
    fullText = `${doc.titolo}\n\n${opts.testo.trim()}`.trim()
    source = 'pdf'
  } else if (doc.contenuto && doc.contenuto.trim().length >= 10) {
    fullText = `${doc.titolo}\n\n${doc.contenuto.trim()}`.trim()
    source = 'text'
  } else {
    return { ok: false, error: 'Contenuto vuoto. Incolla testo nel campo "Contenuto" oppure carica un PDF.' }
  }

  const chunks = chunkText(fullText, 400, 50)
  const rows: { tenant_id: string; documento_id: string; chunk_text: string; chunk_index: number; embedding: number[] }[] = []

  for (let i = 0; i < chunks.length; i++) {
    const vec = await voyageEmbed(chunks[i], voyageApiKey)
    if (!vec) continue
    rows.push({ tenant_id: tenantId, documento_id: documentoId, chunk_text: chunks[i], chunk_index: i, embedding: vec })
  }

  if (rows.length === 0) return { ok: false, error: 'Nessun embedding generato. Verifica VOYAGE_API_KEY.' }

  await supabase.from('kb_documenti_embeddings').delete().eq('documento_id', documentoId).eq('tenant_id', tenantId)
  const { error: insErr } = await supabase.from('kb_documenti_embeddings').insert(rows)
  if (insErr) return { ok: false, error: 'Insert embeddings fallito: ' + insErr.message }

  return { ok: true, chunks: rows.length, source }
}
