import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { ingestKbDocumento } from '../../lib/api'
import { PageHeader } from '../../components/PageHeader'
import { Badge } from '../../components/Badge'
import type { KbDocumento, Proprieta } from '@tenantbot/db'
import { toast } from 'sonner'

type KbRow = KbDocumento & { proprieta?: { nome: string } | null; chunk_count?: number }

const TIPI: KbDocumento['tipo'][] = ['regolamento', 'normativa', 'contatti', 'orari', 'altro']

export function KbPage() {
  const { tenant } = useAuth()
  const [items, setItems] = useState<KbRow[]>([])
  const [proprieta, setPropriety] = useState<Proprieta[]>([])
  const [dialog, setDialog] = useState<Partial<KbDocumento> | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ingesting, setIngesting] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)

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

  async function save() {
    if (!dialog || !tenant) return
    setSaving(true); setError('')

    let pdfPath: string | undefined
    if (pdfFile) {
      const path = `kb/${Date.now()}_${pdfFile.name}`
      const { error: upErr } = await supabase.storage.from('kb-documenti-pdf').upload(path, pdfFile)
      if (upErr) { setError('Upload PDF fallito: ' + upErr.message); setSaving(false); return }
      pdfPath = path
    }

    const { id, ...rest } = dialog
    const payload = { ...rest, tenant_id: tenant.id, ...(pdfPath ? { pdf_storage_path: pdfPath } : {}) }
    const { error: e } = id
      ? await supabase.from('kb_documenti').update(payload).eq('id', id)
      : await supabase.from('kb_documenti').insert(payload)
    setSaving(false)
    if (e) { setError(e.message); return }
    setDialog(null); setPdfFile(null); load()
  }

  async function handleIngest(doc: KbRow) {
    if (!tenant) return
    setIngesting(doc.id)
    let testo: string | undefined

    if (doc.pdf_storage_path) {
      try {
        const { data: blob } = await supabase.storage.from('kb-documenti-pdf').download(doc.pdf_storage_path)
        if (blob) {
          const pdfjs = await import('pdfjs-dist')
          pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`
          const pdf = await pdfjs.getDocument(await blob.arrayBuffer()).promise
          let t = ''
          for (let p = 1; p <= pdf.numPages; p++) {
            const page = await pdf.getPage(p)
            const tc = await page.getTextContent()
            t += tc.items.map((i) => ('str' in i ? i.str ?? '' : '')).join(' ') + '\n'
          }
          testo = t
        }
      } catch { /* fallback a contenuto testo */ }
    }

    const result = await ingestKbDocumento(doc.id, tenant.id, testo)
    if (result.ok) {
      toast.success(`Embedding generati: ${result.chunks} chunk (fonte: ${result.source})`)
    } else {
      toast.error(result.error ?? 'Errore embedding')
    }
    setIngesting(null); load()
  }

  async function remove(id: string) {
    if (!confirm('Eliminare questo documento?')) return
    await supabase.from('kb_documenti').delete().eq('id', id)
    load()
  }

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
                <th className="px-4 py-3 text-left">Proprietà</th>
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
                    <Badge variant={d.pdf_storage_path ? 'info' : 'default'}>{d.pdf_storage_path ? 'PDF' : 'Testo'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={d.chunk_count && d.chunk_count > 0 ? 'success' : 'warning'}>
                      {d.chunk_count && d.chunk_count > 0 ? `${d.chunk_count} chunk` : 'Nessuno'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right flex gap-2 justify-end">
                    <button
                      onClick={() => handleIngest(d)}
                      disabled={ingesting === d.id}
                      className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                    >
                      {ingesting === d.id ? 'Elaboro...' : '🔄 Genera emb.'}
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

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl my-4">
            <h2 className="text-lg font-semibold mb-4">{dialog.id ? 'Modifica' : 'Nuovo'} documento KB</h2>
            <div className="space-y-3">
              <Field label="Titolo"><input value={dialog.titolo ?? ''} onChange={(e) => setDialog({ ...dialog, titolo: e.target.value })} className={INPUT} /></Field>
              <Field label="Tipo">
                <select value={dialog.tipo ?? 'normativa'} onChange={(e) => setDialog({ ...dialog, tipo: e.target.value as KbDocumento['tipo'] })} className={INPUT}>
                  {TIPI.map((t) => <option key={t} value={t ?? ''}>{t}</option>)}
                </select>
              </Field>
              <Field label="Proprietà (opzionale — lascia vuoto per KB globale)">
                <select value={dialog.proprieta_id ?? ''} onChange={(e) => setDialog({ ...dialog, proprieta_id: e.target.value || null })} className={INPUT}>
                  <option value="">Globale (tutte le proprietà)</option>
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
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">PDF (alternativa al testo)</label>
                <input ref={fileRef} type="file" accept=".pdf" onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)} className="text-sm" />
                {dialog.pdf_storage_path && !pdfFile && <p className="text-xs text-green-600 mt-1">✅ PDF già caricato</p>}
              </div>
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

const INPUT = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>{children}</div>
}
