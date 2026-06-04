import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/PageHeader'
import { Badge } from '../../components/Badge'
import type { Inquilino, Proprieta } from '@tenantbot/db'

// Row returned from supabase join: inquilini + inquilino_proprieta
type AssocRow = {
  inquilino_id: string
  proprieta_id: string
  proprieta: { nome: string } | null
}

type InquilinoRow = Inquilino & {
  _propNomi: string   // comma-separated property names for display
  _propIds: string[]  // selected proprieta IDs (populated by load())
}

export function InquiliniPage() {
  const { tenant } = useAuth()
  const [items, setItems] = useState<InquilinoRow[]>([])
  const [proprieta, setProprietа] = useState<Proprieta[]>([])
  const [dialog, setDialog] = useState<Partial<Inquilino> | null>(null)
  const [dialogPropIds, setDialogPropIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  async function load() {
    if (!tenant) return
    const [{ data: inqData }, { data: assocData }, { data: propData }] = await Promise.all([
      supabase.from('inquilini').select('*').order('cognome'),
      supabase.from('inquilino_proprieta').select('inquilino_id, proprieta_id, proprieta(nome)'),
      supabase.from('proprieta').select('*').eq('attivo', true).order('nome'),
    ])

    const assocs = (assocData ?? []) as AssocRow[]

    const enriched: InquilinoRow[] = (inqData ?? []).map((inq) => {
      const mine = assocs.filter((a) => a.inquilino_id === inq.id)
      return {
        ...(inq as Inquilino),
        _propNomi: mine.map((a) => a.proprieta?.nome).filter(Boolean).join(', ') || '—',
        _propIds: mine.map((a) => a.proprieta_id),
      }
    })

    setItems(enriched)
    setProprietа(propData ?? [])
  }

  useEffect(() => { load() }, [tenant])

  function openDialog(inq: InquilinoRow | null) {
    if (!inq) {
      setDialog({ lingua: 'it', attivo: true })
      setDialogPropIds([])
      return
    }
    // Strip UI-only fields before putting into dialog state
    const { _propNomi: _n, _propIds, ...rest } = inq
    setDialog(rest)
    setDialogPropIds(_propIds)
  }

  async function save() {
    if (!dialog || !tenant) return
    setSaving(true); setError('')

    const { id, ...fields } = dialog
    const payload = { ...fields, tenant_id: tenant.id }
    let inquilinoId: string | undefined = id

    if (id) {
      const { error: e } = await supabase.from('inquilini').update(payload).eq('id', id)
      if (e) { setError(e.message); setSaving(false); return }
    } else {
      const { data, error: e } = await supabase
        .from('inquilini')
        .insert(payload)
        .select('id')
        .single()
      if (e || !data) { setError(e?.message ?? 'Errore creazione'); setSaving(false); return }
      inquilinoId = (data as { id: string }).id
    }

    // Sync junction table: delete old associations, insert new ones
    if (inquilinoId) {
      await supabase.from('inquilino_proprieta').delete().eq('inquilino_id', inquilinoId)
      if (dialogPropIds.length > 0) {
        await supabase.from('inquilino_proprieta').insert(
          dialogPropIds.map((pid) => ({
            tenant_id: tenant.id,
            inquilino_id: inquilinoId,
            proprieta_id: pid,
          }))
        )
      }
    }

    setSaving(false)
    setDialog(null)
    load()
  }

  function toggleProp(id: string) {
    setDialogPropIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const filtered = items.filter((i) =>
    `${i.nome} ${i.cognome} ${i.email ?? ''} ${i.telefono_whatsapp ?? ''}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  return (
    <div>
      <PageHeader
        title="Inquilini"
        description="Gestisci gli inquilini e il loro collegamento al bot"
        action={
          <button
            onClick={() => openDialog(null)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            + Nuovo inquilino
          </button>
        }
      />

      <div className="p-8 space-y-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca per nome, email o telefono..."
          className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Nominativo</th>
                <th className="px-4 py-3 text-left">Telefono</th>
                <th className="px-4 py-3 text-left">Proprietà</th>
                <th className="px-4 py-3 text-left">Telegram</th>
                <th className="px-4 py-3 text-left">Stato</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((i) => (
                <tr key={i.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{i.cognome} {i.nome}</td>
                  <td className="px-4 py-3 text-gray-500">{i.telefono_whatsapp ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate" title={i._propNomi}>{i._propNomi}</td>
                  <td className="px-4 py-3">
                    <Badge variant={i.telegram_user_id ? 'success' : 'warning'}>
                      {i.telegram_user_id ? 'Collegato' : 'Non collegato'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={i.attivo ? 'success' : 'default'}>{i.attivo ? 'Attivo' : 'Inattivo'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openDialog(i)} className="text-xs text-brand-600 hover:underline">Modifica</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                    Nessun inquilino trovato
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl my-4">
            <h2 className="text-lg font-semibold mb-4">{dialog.id ? 'Modifica' : 'Nuovo'} inquilino</h2>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome *">
                <input value={dialog.nome ?? ''} onChange={(e) => setDialog({ ...dialog, nome: e.target.value })} className={INPUT} />
              </Field>
              <Field label="Cognome *">
                <input value={dialog.cognome ?? ''} onChange={(e) => setDialog({ ...dialog, cognome: e.target.value })} className={INPUT} />
              </Field>
              <Field label="Telefono (E.164)">
                <input value={dialog.telefono_whatsapp ?? ''} onChange={(e) => setDialog({ ...dialog, telefono_whatsapp: e.target.value })} placeholder="+39333..." className={INPUT} />
              </Field>
              <Field label="Email">
                <input type="email" value={dialog.email ?? ''} onChange={(e) => setDialog({ ...dialog, email: e.target.value })} className={INPUT} />
              </Field>
              <Field label="Codice fiscale">
                <input value={dialog.codice_fiscale ?? ''} onChange={(e) => setDialog({ ...dialog, codice_fiscale: e.target.value })} className={INPUT} />
              </Field>
              <Field label="Lingua">
                <select value={dialog.lingua ?? 'it'} onChange={(e) => setDialog({ ...dialog, lingua: e.target.value as 'it' | 'en' })} className={INPUT}>
                  <option value="it">Italiano</option>
                  <option value="en">English</option>
                </select>
              </Field>
              <Field label="Data ingresso">
                <input type="date" value={dialog.data_ingresso ?? ''} onChange={(e) => setDialog({ ...dialog, data_ingresso: e.target.value || null })} className={INPUT} />
              </Field>
              <Field label="Data uscita">
                <input type="date" value={dialog.data_uscita ?? ''} onChange={(e) => setDialog({ ...dialog, data_uscita: e.target.value || null })} className={INPUT} />
              </Field>
            </div>

            {/* Proprietà associate — multi-select via checkboxes */}
            <div className="mt-5">
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Proprietà associate
                <span className="ml-1 font-normal text-gray-400">(seleziona una o più)</span>
              </label>
              {proprieta.length === 0 ? (
                <p className="text-xs text-gray-400 italic">
                  Nessuna proprietà disponibile. Aggiungine una in Proprietà prima.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {proprieta.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 cursor-pointer hover:bg-gray-50 select-none"
                    >
                      <input
                        type="checkbox"
                        checked={dialogPropIds.includes(p.id)}
                        onChange={() => toggleProp(p.id)}
                        className="accent-brand-600 h-4 w-4 shrink-0"
                      />
                      <span className="text-sm text-gray-800 font-medium">{p.nome}</span>
                      {p.indirizzo && (
                        <span className="ml-auto text-xs text-gray-400">{p.indirizzo}{p.citta ? `, ${p.citta}` : ''}</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={dialog.attivo ?? true}
                onChange={(e) => setDialog({ ...dialog, attivo: e.target.checked })}
                className="accent-brand-600"
              />
              Inquilino attivo
            </label>

            {dialog.telegram_user_id && (
              <p className="mt-2 text-xs text-green-600">✅ Telegram collegato: {dialog.telegram_user_id}</p>
            )}
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setDialog(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                Annulla
              </button>
              <button
                onClick={save}
                disabled={saving || !dialog.nome || !dialog.cognome}
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
