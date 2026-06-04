import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/PageHeader'
import { Badge } from '../../components/Badge'
import type { Unita, Proprieta, StatoUnita } from '@tenantbot/db'
import { toast } from 'sonner'

// ─── helpers ──────────────────────────────────────────────────────────────────

const STATO_OPTIONS: { value: StatoUnita; label: string; variant: 'success' | 'warning' | 'default' | 'danger' }[] = [
  { value: 'pubblicata',  label: 'Disponibile',  variant: 'success' },
  { value: 'occupata',    label: 'Occupata',      variant: 'warning' },
  { value: 'bozza',       label: 'Bozza',         variant: 'default' },
  { value: 'archiviata',  label: 'Archiviata',    variant: 'danger'  },
]

function statoVariant(s: StatoUnita) {
  return STATO_OPTIONS.find(o => o.value === s)?.variant ?? 'default'
}
function statoLabel(s: StatoUnita) {
  return STATO_OPTIONS.find(o => o.value === s)?.label ?? s
}

function buildSlug(propNome: string | undefined, interno: string) {
  const base = propNome?.trim() ?? 'Unità'
  return interno.trim() ? `${base} / Int. ${interno.trim()}` : base
}

// ─── component ────────────────────────────────────────────────────────────────

type UnitaWithProp = Unita & { _propNome?: string }

export function UnitaPage() {
  const { tenant } = useAuth()
  const [proprieta, setProprietaList] = useState<Proprieta[]>([])
  const [unita, setUnita] = useState<UnitaWithProp[]>([])
  const [filterPropId, setFilterPropId] = useState<string>('all')
  const [dialog, setDialog] = useState<Partial<Unita> | null>(null)
  const [saving, setSaving] = useState(false)

  // ── load ────────────────────────────────────────────────────────────────────

  async function load() {
    if (!tenant) return
    const [{ data: props }, { data: units }] = await Promise.all([
      supabase.from('proprieta').select('*').order('nome'),
      supabase.from('unita').select('*').order('slug'),
    ])
    const propList = props ?? []
    setProprietaList(propList)
    const propMap = Object.fromEntries(propList.map(p => [p.id, p.nome]))
    setUnita((units ?? []).map(u => ({ ...u, _propNome: propMap[u.proprieta_id] })))
  }

  useEffect(() => { load() }, [tenant])

  // ── save ────────────────────────────────────────────────────────────────────

  async function save() {
    if (!dialog || !tenant) return
    if (!dialog.proprieta_id) { toast.error('Seleziona la proprietà'); return }
    setSaving(true)

    const propNome = proprieta.find(p => p.id === dialog.proprieta_id)?.nome
    const slug = buildSlug(propNome, dialog.interno ?? '')

    const { id, ...rest } = dialog as Unita
    const payload = {
      ...rest,
      tenant_id: tenant.id,
      slug,
      tipo_immobile: dialog.tipo_immobile ?? 'residenziale',
      stato: dialog.stato ?? 'bozza',
    }

    const { error } = id
      ? await supabase.from('unita').update(payload).eq('id', id)
      : await supabase.from('unita').insert(payload)

    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(id ? 'Unità aggiornata' : 'Unità creata')
    setDialog(null)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Eliminare questa unità? Questa azione non può essere annullata.')) return
    const { error } = await supabase.from('unita').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Unità eliminata')
    load()
  }

  // ── filtered list ────────────────────────────────────────────────────────────

  const visible = filterPropId === 'all'
    ? unita
    : unita.filter(u => u.proprieta_id === filterPropId)

  // Group by property for display
  const grouped = proprieta.reduce<Record<string, UnitaWithProp[]>>((acc, p) => {
    const items = visible.filter(u => u.proprieta_id === p.id)
    if (items.length > 0 || filterPropId === p.id) acc[p.id] = items
    return acc
  }, {})

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Unità"
        description="Gestisci appartamenti e unità immobiliari"
        action={
          <button
            onClick={() => setDialog({ tipo_immobile: 'residenziale', stato: 'bozza', proprieta_id: filterPropId === 'all' ? undefined : filterPropId })}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
          >
            + Nuova unità
          </button>
        }
      />

      <div className="p-8 space-y-6">
        {/* Property filter */}
        {proprieta.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterPropId('all')}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filterPropId === 'all'
                  ? 'bg-brand-600 text-white'
                  : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Tutte le proprietà
            </button>
            {proprieta.map(p => (
              <button
                key={p.id}
                onClick={() => setFilterPropId(p.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  filterPropId === p.id
                    ? 'bg-brand-600 text-white'
                    : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {p.nome}
              </button>
            ))}
          </div>
        )}

        {/* No properties yet */}
        {proprieta.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
            <div className="text-3xl mb-2">🏢</div>
            <div className="text-sm text-gray-500">
              Prima devi creare almeno una proprietà in <strong>Proprietà</strong>.
            </div>
          </div>
        )}

        {/* Grouped by property */}
        {Object.entries(grouped).map(([propId, items]) => {
          const prop = proprieta.find(p => p.id === propId)
          return (
            <div key={propId}>
              {(filterPropId === 'all' || proprieta.length === 1) && (
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span>🏢</span> {prop?.nome ?? 'Proprietà'}
                  {prop?.indirizzo && (
                    <span className="font-normal text-gray-400">— {prop.indirizzo}</span>
                  )}
                </h3>
              )}

              {items.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
                  Nessuna unità in questa proprietà.{' '}
                  <button
                    onClick={() => setDialog({ tipo_immobile: 'residenziale', stato: 'bozza', proprieta_id: propId })}
                    className="text-brand-600 hover:underline"
                  >
                    Aggiungi la prima
                  </button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {items.map(u => (
                    <div
                      key={u.id}
                      className="rounded-xl border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-medium text-gray-900 text-sm leading-tight">
                          {u.interno ? `Int. ${u.interno}` : '—'}
                          {u.piano != null && (
                            <span className="text-gray-400 font-normal ml-1">· P{u.piano}</span>
                          )}
                        </div>
                        <Badge variant={statoVariant(u.stato)}>{statoLabel(u.stato)}</Badge>
                      </div>
                      <div className="text-xs text-gray-500 space-y-0.5">
                        <div className="capitalize">{u.tipo_immobile}</div>
                        {u.mq && <div>{u.mq} m²</div>}
                        {u.locali && <div>{u.locali} local{u.locali === 1 ? 'e' : 'i'}</div>}
                      </div>
                      <div className="mt-3 flex gap-3">
                        <button
                          onClick={() => setDialog(u)}
                          className="text-xs text-brand-600 hover:underline"
                        >
                          Modifica
                        </button>
                        <button
                          onClick={() => remove(u.id)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Elimina
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* No units at all + there are properties */}
        {proprieta.length > 0 && visible.length === 0 && Object.keys(grouped).length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
            <div className="text-3xl mb-2">🚪</div>
            <div className="text-sm text-gray-500">
              Nessuna unità ancora.{' '}
              <button
                onClick={() => setDialog({ tipo_immobile: 'residenziale', stato: 'bozza' })}
                className="text-brand-600 hover:underline"
              >
                Crea la prima unità
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Dialog ── */}
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl my-4">
            <h2 className="text-lg font-semibold mb-4">
              {(dialog as Unita).id ? 'Modifica unità' : 'Nuova unità'}
            </h2>

            <div className="space-y-3">
              {/* Property */}
              <Field label="Proprietà *">
                <select
                  value={dialog.proprieta_id ?? ''}
                  onChange={(e) => setDialog({ ...dialog, proprieta_id: e.target.value })}
                  className={INPUT}
                >
                  <option value="">— Seleziona proprietà —</option>
                  {proprieta.map(p => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </Field>

              {/* Interno */}
              <Field label="Numero interno (es. 2A, B3)">
                <input
                  value={dialog.interno ?? ''}
                  onChange={(e) => setDialog({ ...dialog, interno: e.target.value })}
                  className={INPUT}
                  placeholder="2A"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                {/* Piano */}
                <Field label="Piano">
                  <input
                    type="number"
                    min={0}
                    value={dialog.piano ?? ''}
                    onChange={(e) => setDialog({ ...dialog, piano: e.target.value ? Number(e.target.value) : null })}
                    className={INPUT}
                    placeholder="0 = T"
                  />
                </Field>

                {/* Tipo */}
                <Field label="Tipo immobile">
                  <select
                    value={dialog.tipo_immobile ?? 'residenziale'}
                    onChange={(e) => setDialog({ ...dialog, tipo_immobile: e.target.value as Unita['tipo_immobile'] })}
                    className={INPUT}
                  >
                    <option value="residenziale">Residenziale</option>
                    <option value="commerciale">Commerciale</option>
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* MQ */}
                <Field label="m²">
                  <input
                    type="number"
                    min={1}
                    value={dialog.mq ?? ''}
                    onChange={(e) => setDialog({ ...dialog, mq: e.target.value ? Number(e.target.value) : null })}
                    className={INPUT}
                    placeholder="65"
                  />
                </Field>

                {/* Locali */}
                <Field label="Locali">
                  <input
                    type="number"
                    min={1}
                    value={dialog.locali ?? ''}
                    onChange={(e) => setDialog({ ...dialog, locali: e.target.value ? Number(e.target.value) : null })}
                    className={INPUT}
                    placeholder="3"
                  />
                </Field>

                {/* Bagni */}
                <Field label="Bagni">
                  <input
                    type="number"
                    min={1}
                    value={dialog.bagni ?? ''}
                    onChange={(e) => setDialog({ ...dialog, bagni: e.target.value ? Number(e.target.value) : null })}
                    className={INPUT}
                    placeholder="1"
                  />
                </Field>
              </div>

              {/* Stato */}
              <Field label="Stato">
                <select
                  value={dialog.stato ?? 'bozza'}
                  onChange={(e) => setDialog({ ...dialog, stato: e.target.value as StatoUnita })}
                  className={INPUT}
                >
                  {STATO_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>

              {/* Descrizione */}
              <Field label="Note (opzionale)">
                <textarea
                  value={dialog.descrizione ?? ''}
                  onChange={(e) => setDialog({ ...dialog, descrizione: e.target.value || null })}
                  rows={2}
                  className={INPUT + ' resize-none'}
                  placeholder="Caratteristiche particolari, vista, ristrutturazione..."
                />
              </Field>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setDialog(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
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

const INPUT = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}
