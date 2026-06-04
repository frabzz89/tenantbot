import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/PageHeader'
import { Badge } from '../../components/Badge'
import type { Proprieta } from '@tenantbot/db'

export function ProprietaPage() {
  const { tenant } = useAuth()
  const [items, setItems] = useState<Proprieta[]>([])
  const [dialog, setDialog] = useState<Partial<Proprieta> | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    if (!tenant) return
    const { data } = await supabase.from('proprieta').select('*').order('nome')
    setItems(data ?? [])
  }

  useEffect(() => { load() }, [tenant])

  async function save() {
    if (!dialog || !tenant) return
    setSaving(true); setError('')
    const payload = { ...dialog, tenant_id: tenant.id }
    const { error: e } = dialog.id
      ? await supabase.from('proprieta').update(payload).eq('id', dialog.id)
      : await supabase.from('proprieta').insert(payload)
    setSaving(false)
    if (e) { setError(e.message); return }
    setDialog(null); load()
  }

  async function remove(id: string) {
    if (!confirm('Eliminare questa proprietà?')) return
    await supabase.from('proprieta').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <PageHeader
        title="Palazzine"
        description="Gestisci i tuoi edifici e palazzine"
        action={
          <button
            onClick={() => setDialog({ tipo: 'residenziale', attivo: true })}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
          >
            + Nuova palazzina
          </button>
        }
      />

      <div className="p-8">
        {items.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
            <div className="text-3xl mb-2">🏢</div>
            <div className="text-sm text-gray-500">Nessuna palazzina ancora. Aggiungine una per iniziare.</div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <div key={p.id} className="rounded-xl border border-gray-200 bg-white p-5 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-gray-900">{p.nome}</div>
                    {p.indirizzo && <div className="text-xs text-gray-500 mt-0.5">{p.indirizzo}{p.citta ? `, ${p.citta}` : ''}</div>}
                  </div>
                  <Badge variant={p.attivo ? 'success' : 'default'}>{p.attivo ? 'Attiva' : 'Inattiva'}</Badge>
                </div>
                <Badge>{p.tipo}</Badge>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setDialog(p)}
                    className="text-xs text-brand-600 hover:underline"
                  >Modifica</button>
                  <button
                    onClick={() => remove(p.id)}
                    className="text-xs text-red-500 hover:underline"
                  >Elimina</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog */}
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4">{dialog.id ? 'Modifica' : 'Nuova'} palazzina</h2>
            <div className="space-y-3">
              <Field label="Nome">
                <input value={dialog.nome ?? ''} onChange={(e) => setDialog({ ...dialog, nome: e.target.value })} className={INPUT} />
              </Field>
              <Field label="Indirizzo">
                <input value={dialog.indirizzo ?? ''} onChange={(e) => setDialog({ ...dialog, indirizzo: e.target.value })} className={INPUT} />
              </Field>
              <Field label="Città">
                <input value={dialog.citta ?? ''} onChange={(e) => setDialog({ ...dialog, citta: e.target.value })} className={INPUT} />
              </Field>
              <Field label="Tipo">
                <select value={dialog.tipo ?? 'residenziale'} onChange={(e) => setDialog({ ...dialog, tipo: e.target.value as Proprieta['tipo'] })} className={INPUT}>
                  <option value="residenziale">Residenziale</option>
                  <option value="commerciale">Commerciale</option>
                  <option value="misto">Misto</option>
                </select>
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={dialog.attivo ?? true} onChange={(e) => setDialog({ ...dialog, attivo: e.target.checked })} />
                Attiva
              </label>
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setDialog(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annulla</button>
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
