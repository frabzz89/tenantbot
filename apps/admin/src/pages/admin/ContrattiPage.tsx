import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { ingestContratto } from '../../lib/api'
import { PageHeader } from '../../components/PageHeader'
import { Badge } from '../../components/Badge'
import type { Contratto, Inquilino, Unita } from '@tenantbot/db'
import { toast } from 'sonner'

type ContrattoRow = Contratto & {
  inquilino?: { nome: string; cognome: string } | null
  unita?: { slug: string } | null
  chunk_count?: number
}

export function ContrattiPage() {
  const { tenant } = useAuth()
  const [items, setItems] = useState<ContrattoRow[]>([])
  const [inquilini, setInquilini] = useState<Inquilino[]>([])
  const [unita, setUnita] = useState<Unita[]>([])
  const [dialog, setDialog] = useState<Partial<Contratto> | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ingesting, setIngesting] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)

  async function load() {
    if (!tenant) return
    const { data } = await supabase
      .from('contratti')
      .select('*, inquilino:inquilino_id(nome,cognome), unita:unita_id(slug)')
      .order('created_at', { ascending: false })

    const withCounts = await Promise.all(
      (data ?? []).map(async (c) => {
        const { count } = await supabase
          .from('contratti_embeddings')
          .select('id', { count: 'exact', head: true })
          .eq('contratto_id', c.id)
        return { ...c, chunk_count: count ?? 0 }
      })
    )
    setItems(withCounts)

    const [{ data: inq }, { data: u }] = await Promise.all([
      supabase.from('inquilini').select('*').eq('attivo', true).order('cognome'),
      supabase.from('unita').select('*').order('slug'),
    ])
    setInquilini(inq ?? [])
    setUnita(u ?? [])
  }

  useEffect(() => { load() }, [tenant])

  async function save() {
    if (!dialog || !tenant) return
    setSaving(true); setError('')

    let pdfPath: string | undefined
    if (pdfFile) {
      const path = `contratti/${tenant.id}/${Date.now()}_${pdfFile.name}`
      const { error: upErr } = await supabase.storage.from('contratti-pdf').upload(path, pdfFile)
      if (upErr) { setError('Upload PDF fallito: ' + upErr.message); setSaving(false); return }
      pdfPath = path
    }

    const { id, ...rest } = dialog
    const payload = { ...rest, tenant_id: tenant.id, ...(pdfPath ? { pdf_storage_path: pdfPath } : {}) }
    const { data: saved, error: e } = id
      ? await supabase.from('contratti').update(payload).eq('id', id).select('id').single()
      : await supabase.from('contratti').insert(payload).select('id').single()
    setSaving(false)
    if (e) { setError(e.message); return }

    // Auto-genera embedding se c'è un PDF e testo
    if (pdfFile && saved) {
      toast.info('Carica PDF completato. Genera ora gli embeddings.')
    }

    setDialog(null); setPdfFile(null); load()
  }

  async function handleIngest(contratto: ContrattoRow) {
    if (!tenant) return
    if (!contratto.pdf_storage_path) { toast.error('Nessun PDF caricato per questo contratto'); return }

    setIngesting(contratto.id)
    try {
      // Scarica PDF da storage, estrai testo nel browser tramite pdfjs
      const { data: blob } = await supabase.storage.from('contratti-pdf').download(contratto.pdf_storage_path)
      if (!blob) throw new Error('PDF non scaricabile')

      const pdfjs = await import('pdfjs-dist')
      pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`
      const pdf = await pdfjs.getDocument(await blob.arrayBuffer()).promise
      let testo = ''
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p)
        const tc = await page.getTextContent()
        testo += tc.items.map((i: { str?: string }) => i.str ?? '').join(' ') + '\n'
      }

      const result = await ingestContratto(contratto.id, tenant.id, testo)
      if (result.ok) {
        toast.success(`Embedding generati: ${result.chunks} chunk`)
      } else {
        toast.error(result.error ?? 'Errore embedding')
      }
    } catch (err) {
      toast.error('Errore: ' + (err instanceof Error ? err.message : String(err)))
    }
    setIngesting(null); load()
  }

  return (
    <div>
      <PageHeader
        title="Contratti"
        description="Gestisci i contratti di locazione e gli embeddings RAG"
        action={
          <button
            onClick={() => setDialog({ attivo: true, preavviso_mesi: 6 })}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            + Nuovo contratto
          </button>
        }
      />

      <div className="p-8">
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Inquilino</th>
                <th className="px-4 py-3 text-left">Unità</th>
                <th className="px-4 py-3 text-left">Canone</th>
                <th className="px-4 py-3 text-left">Scadenza</th>
                <th className="px-4 py-3 text-left">PDF / Emb.</th>
                <th className="px-4 py-3 text-left">Stato</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{(c.inquilino as { nome: string; cognome: string } | null)?.cognome} {(c.inquilino as { nome: string; cognome: string } | null)?.nome}</td>
                  <td className="px-4 py-3 text-gray-500">{(c.unita as { slug: string } | null)?.slug ?? '—'}</td>
                  <td className="px-4 py-3">€{(Number(c.canone)/12).toFixed(0)}/mese</td>
                  <td className="px-4 py-3 text-gray-500">{c.data_scadenza ? new Date(c.data_scadenza).toLocaleDateString('it-IT') : '—'}</td>
                  <td className="px-4 py-3">
                    {c.pdf_storage_path ? (
                      <Badge variant={c.chunk_count && c.chunk_count > 0 ? 'success' : 'warning'}>
                        {c.chunk_count && c.chunk_count > 0 ? `${c.chunk_count} chunk` : 'PDF senza emb.'}
                      </Badge>
                    ) : (
                      <Badge>Senza PDF</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={c.attivo ? 'success' : 'default'}>{c.attivo ? 'Attivo' : 'Scaduto'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right flex gap-2 justify-end">
                    {c.pdf_storage_path && (
                      <button
                        onClick={() => handleIngest(c)}
                        disabled={ingesting === c.id}
                        className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                      >
                        {ingesting === c.id ? 'Elaboro...' : '🔄 Genera emb.'}
                      </button>
                    )}
                    <button onClick={() => setDialog(c)} className="text-xs text-brand-600 hover:underline">Modifica</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">Nessun contratto ancora</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl my-4">
            <h2 className="text-lg font-semibold mb-4">{dialog.id ? 'Modifica' : 'Nuovo'} contratto</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Inquilino">
                <select value={dialog.inquilino_id ?? ''} onChange={(e) => setDialog({ ...dialog, inquilino_id: e.target.value })} className={INPUT}>
                  <option value="">Seleziona...</option>
                  {inquilini.map((i) => <option key={i.id} value={i.id}>{i.cognome} {i.nome}</option>)}
                </select>
              </Field>
              <Field label="Unità">
                <select value={dialog.unita_id ?? ''} onChange={(e) => setDialog({ ...dialog, unita_id: e.target.value })} className={INPUT}>
                  <option value="">Seleziona...</option>
                  {unita.map((u) => <option key={u.id} value={u.id}>{u.slug}</option>)}
                </select>
              </Field>
              <Field label="Canone annuale (€)"><input type="number" value={dialog.canone ?? ''} onChange={(e) => setDialog({ ...dialog, canone: Number(e.target.value) })} className={INPUT} /></Field>
              <Field label="Cauzione (€)"><input type="number" value={dialog.cauzione ?? ''} onChange={(e) => setDialog({ ...dialog, cauzione: Number(e.target.value) || null })} className={INPUT} /></Field>
              <Field label="Data firma"><input type="date" value={dialog.data_firma ?? ''} onChange={(e) => setDialog({ ...dialog, data_firma: e.target.value })} className={INPUT} /></Field>
              <Field label="Data inizio"><input type="date" value={dialog.data_inizio ?? ''} onChange={(e) => setDialog({ ...dialog, data_inizio: e.target.value })} className={INPUT} /></Field>
              <Field label="Data scadenza"><input type="date" value={dialog.data_scadenza ?? ''} onChange={(e) => setDialog({ ...dialog, data_scadenza: e.target.value || null })} className={INPUT} /></Field>
              <Field label="Tipo (es. 4+4)"><input value={dialog.tipo ?? ''} onChange={(e) => setDialog({ ...dialog, tipo: e.target.value || null })} className={INPUT} /></Field>
              <Field label="Preavviso (mesi)"><input type="number" value={dialog.preavviso_mesi ?? 6} onChange={(e) => setDialog({ ...dialog, preavviso_mesi: Number(e.target.value) })} className={INPUT} /></Field>
              <Field label="IBAN"><input value={dialog.iban_pagamento ?? ''} onChange={(e) => setDialog({ ...dialog, iban_pagamento: e.target.value || null })} className={INPUT} /></Field>
            </div>
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">PDF contratto</label>
              <input ref={fileRef} type="file" accept=".pdf" onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)} className="text-sm" />
              {dialog.pdf_storage_path && !pdfFile && <p className="text-xs text-green-600 mt-1">✅ PDF già caricato</p>}
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={dialog.attivo ?? true} onChange={(e) => setDialog({ ...dialog, attivo: e.target.checked })} />
              Attivo
            </label>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => { setDialog(null); setPdfFile(null) }} className="px-4 py-2 text-sm text-gray-600">Annulla</button>
              <button onClick={save} disabled={saving} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                {saving ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const INPUT = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>{children}</div>
}
