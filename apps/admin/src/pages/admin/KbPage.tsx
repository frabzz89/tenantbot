import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { ingestKbDocumento } from '../../lib/api'
import { PageHeader } from '../../components/PageHeader'
import { Badge } from '../../components/Badge'
import type { KbDocumento, Proprieta } from '@tenantbot/db'
import { toast } from 'sonner'

// Self-hosted pdfjs worker — Vite bundles the file, no CDN dependency
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// ─── types ────────────────────────────────────────────────────────────────────

type KbRow = KbDocumento & { proprieta?: { nome: string } | null; chunk_count?: number }

const TIPI: KbDocumento['tipo'][] = ['regolamento', 'normativa', 'contatti', 'orari', 'altro']

// ─── PDF text extraction (client-side, pdfjs) ─────────────────────────────────

async function extractPdfText(file: Blob): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl
  const pdf = await pdfjs.getDocument(await file.arrayBuffer()).promise
  let text = ''
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const tc = await page.getTextContent()
    text += tc.items.map((i) => ('str' in i ? i.str ?? '' : '')).join(' ') + '\n'
  }
  return text.trim()
}

// ─── component ────────────────────────────────────────────────────────────────

export function KbPage() {
  const { tenant } = useAuth()
  const [items, setItems] = useState<KbRow[]>([])
  const [proprieta, setPropriety] = useState<Proprieta[]>([])
  const [dialog, setDialog] = useState<Partial<KbDocumento> | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ingesting, setIngesting] = useState<string | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)

  // ── load ────────────────────────────────────────────────────────────────────

  async function load() {
    if (!tenant) return
    const { data } = await supabase
      .from('kb_documenti')
      .select('*, proprieta:proprieta_id(nome)')
      .order('titolo')

    const withCounts = await Promise.all(
      (data ?? []).map(async (d) => {
        const { count } = await supabase
          .from('kb_documenti_embeddings')
          .select('id', { count: 'exact', head: true })
          .eq('documento_id', d.id)
        return { ...d, chunk_count: count ?? 0 }
      })
    )
    setItems(withCounts)

    const { data: p } = await supabase.from('proprieta').select('*').order('nome')
    setPropriety(p ?? [])
  }

  useEffect(() => { load() }, [tenant])

  // ── save + auto-ingest ──────────────────────────────────────────────────────

  async function save() {
    if (!dialog || !tenant) return
    setSaving(true); setError('')

    // 1. Upload PDF if present
    let pdfPath: string | undefined
    if (pdfFile) {
      const path = `kb/${Date.now()}_${pdfFile.name}`
      const { error: upErr } = await supabase.storage.from('kb-documenti-pdf').upload(path, pdfFile)
      if (upErr) { setError('Upload PDF fallito: ' + upErr.message); setSaving(false); return }
      pdfPath = path
    }

    // 2. Save document
    const { id, ...rest } = dialog
    const payload = { ...rest, tenant_id: tenant.id, ...(pdfPath ? { pdf_storage_path: pdfPath } : {}) }
    const { data: saved, error: e } = id
      ? await supabase.from('kb_documenti').update(payload).eq('id', id).select('id').single()
      : await supabase.from('kb_documenti').insert(payload).select('id').single()

    setSaving(false)
    if (e) { setError(e.message); return }

    // 3. Close dialog immediately
    setDialog(null); setPdfFile(null)

    // 4. Auto-trigger embedding if we have a PDF (new upload or existing)
    const docId = (saved as { id: string })?.id ?? id
    const storagePath = pdfPath ?? dialog.pdf_storage_path
    if (docId && storagePath) {
      await runIngest(docId, storagePath, dialog.contenuto ?? undefined)
    } else {
      load()
    }
  }

  // ── run embedding ───────────────────────────────────────────────────────────

  async function runIngest(docId: string, storagePath: string | undefined, testo?: string) {
    if (!tenant) return
    setIngesting(docId)
    try {
      let finalTesto = testo

      // Extract from PDF if available
      if (storagePath) {
        const { data: blob } = await supabase.storage.from('kb-documenti-pdf').download(storagePath)
        if (!blob) throw new Error('PDF non scaricabile dallo storage')

        toast.info('Estrazione testo dal PDF...')
        finalTesto = await extractPdfText(blob)
        if (!finalTesto || finalTesto.length < 20) throw new Error('Testo estratto troppo corto — PDF scansionato o protetto?')
      }

      toast.info('Generazione embeddings...')
      const result = await ingestKbDocumento(docId, tenant.id, finalTesto)
      if (result.ok) {
        toast.success(`Embedding generati: ${result.chunks} chunk (fonte: ${result.source})`)
      } else {
        toast.error(result.error ?? 'Errore embedding')
      }
    } catch (err) {
      toast.error('Errore embedding: ' + (err instanceof Error ? err.message : String(err)))
    }
    setIngesting(null)
    load()
  }

  // ── manual re-generate (from table row) ─────────────────────────────────────

  async function handleReIngest(d: KbRow) {
    await runIngest(d.id, d.pdf_storage_path ?? undefined, d.contenuto ?? undefined)
  }

  async function remove(id: string) {
    if (!confirm('Eliminare questo documento?')) return
    await supabase.from('kb_documenti').delete().eq('id', id)
    load()
  }

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Knowledge Base Normativa"
        description="Documenti da cui il bot risponde alle domande su normativa e regolamenti"
        action={
          <button
            onClick={() => setDialog({ tipo: 'normativa', attivo: true })}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            + Nuovo documento
          </button>
        }
      />

      <div className="p-8">
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Titolo</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Palazzina</th>
                <th className="px-4 py-3 text-left">Fonte</th>
                <th className="px-4 py-3 text-left">Embedding</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{d.titolo}</td>
                  <td className="px-4 py-3"><Badge>{d.tipo ?? '—'}</Badge></td>
                  <td className="px-4 py-3 text-gray-500">{(d.proprieta as { nome: string } | null)?.nome ?? 'Globale'}</td>
                  <td className="px-4 py-3">
                    {ingesting === d.id ? (
                      <Badge variant="info">⏳ Elaboro...</Badge>
                    ) : (
                      <Badge variant={d.pdf_storage_path ? 'info' : 'default'}>{d.pdf_storage_path ? 'PDF' : 'Testo'}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={d.chunk_count && d.chunk_count > 0 ? 'success' : 'warning'}>
                      {d.chunk_count && d.chunk_count > 0 ? `${d.chunk_count} chunk` : 'Nessuno'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right flex gap-2 justify-end">
                    <button
                      onClick={() => handleReIngest(d)}
                      disabled={ingesting === d.id}
                      className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                      title="Rigenera gli embeddings"
                    >
                      {ingesting === d.id ? 'Elaboro...' : '🔄 Rigenera'}
                    </button>
                    <button onClick={() => setDialog(d)} className="text-xs text-brand-600 hover:underline">Modifica</button>
                    <button onClick={() => remove(d.id)} className="text-xs text-red-500 hover:underline">Elimina</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">Nessun documento KB ancora</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Dialog ── */}
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl my-4">
            <h2 className="text-lg font-semibold mb-4">{dialog.id ? 'Modifica' : 'Nuovo'} documento KB</h2>
            <div className="space-y-3">
              <Field label="Titolo">
                <input value={dialog.titolo ?? ''} onChange={(e) => setDialog({ ...dialog, titolo: e.target.value })} className={INPUT} />
              </Field>
              <Field label="Tipo">
                <select value={dialog.tipo ?? 'normativa'} onChange={(e) => setDialog({ ...dialog, tipo: e.target.value as KbDocumento['tipo'] })} className={INPUT}>
                  {TIPI.map((t) => <option key={t} value={t ?? ''}>{t}</option>)}
                </select>
              </Field>
              <Field label="Palazzina (opzionale — lascia vuoto per KB globale)">
                <select value={dialog.proprieta_id ?? ''} onChange={(e) => setDialog({ ...dialog, proprieta_id: e.target.value || null })} className={INPUT}>
                  <option value="">Globale (tutte le palazzine)</option>
                  {proprieta.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </Field>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Testo (alternativa al PDF)</label>
                <textarea
                  value={dialog.contenuto ?? ''}
                  onChange={(e) => setDialog({ ...dialog, contenuto: e.target.value || null })}
                  rows={5}
                  className={INPUT + ' resize-none'}
                  placeholder="Incolla qui il testo del documento..."
                />
              </div>

              {/* PDF picker */}
              <FilePicker
                label="PDF documento"
                hint="Il testo verrà estratto automaticamente per il motore RAG."
                value={pdfFile}
                onChange={setPdfFile}
                hasExisting={!!dialog.pdf_storage_path}
              />

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={dialog.attivo ?? true} onChange={(e) => setDialog({ ...dialog, attivo: e.target.checked })} />
                Attivo
              </label>
            </div>
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

// ─── shared helpers ───────────────────────────────────────────────────────────

const INPUT = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>{children}</div>
}

function FilePicker({
  label,
  hint,
  value,
  onChange,
  hasExisting,
}: {
  label: string
  hint?: string
  value: File | null
  onChange: (f: File | null) => void
  hasExisting?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="rounded-lg border-2 border-dashed border-gray-300 px-4 py-2 text-sm text-gray-600 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
        >
          📎 Seleziona file PDF
        </button>
        <span className="text-sm text-gray-500 truncate max-w-[200px]">
          {value ? value.name : hasExisting ? '✅ PDF già caricato' : 'Nessun file selezionato'}
        </span>
        {value && (
          <button
            type="button"
            onClick={() => { onChange(null); if (ref.current) ref.current.value = '' }}
            className="text-xs text-red-400 hover:text-red-600"
          >
            ✕
          </button>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
      <input ref={ref} type="file" accept=".pdf" className="sr-only" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
    </div>
  )
}
