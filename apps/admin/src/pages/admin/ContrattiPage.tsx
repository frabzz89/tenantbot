import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { ingestContratto } from '../../lib/api'
import { PageHeader } from '../../components/PageHeader'
import { Badge } from '../../components/Badge'
import type { Contratto, Inquilino, Unita } from '@tenantbot/db'
import { toast } from 'sonner'

// Self-hosted pdfjs worker — Vite bundles the file, no CDN dependency
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// ─── types ────────────────────────────────────────────────────────────────────

type ContrattoRow = Contratto & {
  inquilino?: { nome: string; cognome: string } | null
  unita?: { slug: string } | null
  chunk_count?: number
}

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

export function ContrattiPage() {
  const { tenant } = useAuth()
  const [items, setItems] = useState<ContrattoRow[]>([])
  const [inquilini, setInquilini] = useState<Inquilino[]>([])
  const [unita, setUnita] = useState<Unita[]>([])
  const [dialog, setDialog] = useState<Partial<Contratto> | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ingesting, setIngesting] = useState<string | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)

  // ── load ────────────────────────────────────────────────────────────────────

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

  // ── save + auto-ingest ──────────────────────────────────────────────────────

  async function save() {
    if (!dialog || !tenant) return
    setSaving(true); setError('')

    // 1. Upload PDF if present
    let pdfPath: string | undefined
    if (pdfFile) {
      const path = `contratti/${tenant.id}/${Date.now()}_${pdfFile.name}`
      const { error: upErr } = await supabase.storage.from('contratti-pdf').upload(path, pdfFile)
      if (upErr) { setError('Upload PDF fallito: ' + upErr.message); setSaving(false); return }
      pdfPath = path
    }

    // 2. Save contract — strip virtual/joined fields that are not DB columns
    const { id, chunk_count: _cc, inquilino: _inq, unita: _uni, ...rest } = dialog as ContrattoRow
    const payload = { ...rest, tenant_id: tenant.id, ...(pdfPath ? { pdf_storage_path: pdfPath } : {}) }
    const { data: saved, error: e } = id
      ? await supabase.from('contratti').update(payload).eq('id', id).select('id').single()
      : await supabase.from('contratti').insert(payload).select('id').single()

    setSaving(false)
    if (e) { setError(e.message); return }

    // 3. Close dialog immediately
    setDialog(null); setPdfFile(null)

    // 4. Auto-trigger embedding if we have a PDF (new upload or existing)
    const contrattoId = (saved as { id: string })?.id ?? id
    const storagePath = pdfPath ?? dialog.pdf_storage_path
    if (contrattoId && storagePath) {
      await runIngest(contrattoId, storagePath)
    } else {
      load()
    }
  }

  // ── run embedding (download PDF → extract → embed) ──────────────────────────

  async function runIngest(contrattoId: string, storagePath: string) {
    if (!tenant) return
    setIngesting(contrattoId)
    try {
      const { data: blob } = await supabase.storage.from('contratti-pdf').download(storagePath)
      if (!blob) throw new Error('PDF non scaricabile dallo storage')

      toast.info('Estrazione testo dal PDF...')
      const testo = await extractPdfText(blob)
      if (!testo || testo.length < 20) throw new Error('Testo estratto troppo corto — PDF scansionato o protetto?')

      toast.info('Generazione embeddings...')
      const result = await ingestContratto(contrattoId, tenant.id, testo)
      if (result.ok) {
        toast.success(`✅ Embedding generati: ${result.chunks} chunk`)
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

  async function handleReIngest(c: ContrattoRow) {
    if (!c.pdf_storage_path) { toast.error('Nessun PDF per questo contratto'); return }
    await runIngest(c.id, c.pdf_storage_path)
  }

  // ── render ──────────────────────────────────────────────────────────────────

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
                  <td className="px-4 py-3 font-medium">
                    {(c.inquilino as { nome: string; cognome: string } | null)?.cognome}{' '}
                    {(c.inquilino as { nome: string; cognome: string } | null)?.nome}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{(c.unita as { slug: string } | null)?.slug ?? '—'}</td>
                  <td className="px-4 py-3">€{(Number(c.canone) / 12).toFixed(0)}/mese</td>
                  <td className="px-4 py-3 text-gray-500">
                    {c.data_scadenza ? new Date(c.data_scadenza).toLocaleDateString('it-IT') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {ingesting === c.id ? (
                      <Badge variant="info">⏳ Elaboro...</Badge>
                    ) : c.pdf_storage_path ? (
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
                        onClick={() => handleReIngest(c)}
                        disabled={ingesting === c.id}
                        className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                        title="Rigenera gli embeddings"
                      >
                        {ingesting === c.id ? 'Elaboro...' : '🔄 Rigenera'}
                      </button>
                    )}
                    <button onClick={() => setDialog(c)} className="text-xs text-brand-600 hover:underline">
                      Modifica
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                    Nessun contratto ancora
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Dialog ── */}
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl my-4">
            <h2 className="text-lg font-semibold mb-4">{dialog.id ? 'Modifica' : 'Nuovo'} contratto</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Inquilino">
                <select
                  value={dialog.inquilino_id ?? ''}
                  onChange={(e) => setDialog({ ...dialog, inquilino_id: e.target.value })}
                  className={INPUT}
                >
                  <option value="">Seleziona...</option>
                  {inquilini.map((i) => (
                    <option key={i.id} value={i.id}>{i.cognome} {i.nome}</option>
                  ))}
                </select>
              </Field>
              <Field label="Unità">
                <select
                  value={dialog.unita_id ?? ''}
                  onChange={(e) => setDialog({ ...dialog, unita_id: e.target.value })}
                  className={INPUT}
                >
                  <option value="">Seleziona...</option>
                  {unita.map((u) => <option key={u.id} value={u.id}>{u.slug}</option>)}
                </select>
              </Field>
              <Field label="Canone annuale (€)">
                <input type="number" value={dialog.canone ?? ''} onChange={(e) => setDialog({ ...dialog, canone: Number(e.target.value) })} className={INPUT} />
              </Field>
              <Field label="Cauzione (€)">
                <input type="number" value={dialog.cauzione ?? ''} onChange={(e) => setDialog({ ...dialog, cauzione: Number(e.target.value) || null })} className={INPUT} />
              </Field>
              <Field label="Data firma">
                <input type="date" value={dialog.data_firma ?? ''} onChange={(e) => setDialog({ ...dialog, data_firma: e.target.value })} className={INPUT} />
              </Field>
              <Field label="Data inizio">
                <input type="date" value={dialog.data_inizio ?? ''} onChange={(e) => setDialog({ ...dialog, data_inizio: e.target.value })} className={INPUT} />
              </Field>
              <Field label="Data scadenza">
                <input type="date" value={dialog.data_scadenza ?? ''} onChange={(e) => setDialog({ ...dialog, data_scadenza: e.target.value || null })} className={INPUT} />
              </Field>
              <Field label="Tipo (es. 4+4)">
                <input value={dialog.tipo ?? ''} onChange={(e) => setDialog({ ...dialog, tipo: e.target.value || null })} className={INPUT} />
              </Field>
              <Field label="Preavviso (mesi)">
                <input type="number" value={dialog.preavviso_mesi ?? 6} onChange={(e) => setDialog({ ...dialog, preavviso_mesi: Number(e.target.value) })} className={INPUT} />
              </Field>
              <Field label="IBAN">
                <input value={dialog.iban_pagamento ?? ''} onChange={(e) => setDialog({ ...dialog, iban_pagamento: e.target.value || null })} className={INPUT} />
              </Field>
            </div>

            {/* PDF picker */}
            <div className="mt-4">
              <FilePicker
                label="PDF contratto"
                hint="Il testo verrà estratto automaticamente per il motore RAG."
                value={pdfFile}
                onChange={setPdfFile}
                hasExisting={!!dialog.pdf_storage_path}
              />
            </div>

            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={dialog.attivo ?? true} onChange={(e) => setDialog({ ...dialog, attivo: e.target.checked })} />
              Attivo
            </label>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => { setDialog(null); setPdfFile(null) }} className="px-4 py-2 text-sm text-gray-600">
                Annulla
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
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
