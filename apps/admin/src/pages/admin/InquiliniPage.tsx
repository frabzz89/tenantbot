import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/PageHeader'
import { Badge } from '../../components/Badge'
import type { Inquilino, Unita } from '@tenantbot/db'

type InquilinoRow = Inquilino & { unita?: { slug: string } | null }

export function InquiliniPage() {
  const { tenant } = useAuth()
  const [items, setItems] = useState<InquilinoRow[]>([])
  const [unita, setUnita] = useState<Unita[]>([])
  const [dialog, setDialog] = useState<Partial<Inquilino> | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  async function load() {
    if (!tenant) return
    const { data } = await supabase
      .from('inquilini')
      .select('*, unita:unita_id(slug)')
      .order('cognome')
    setItems(data ?? [])
    const { data: u } = await supabase.from('unita').select('*').eq('stato', 'occupata').order('slug')
    setUnita(u ?? [])
  }

  useEffect(() => { load() }, [tenant])

  async function save() {
    if (!dialog || !tenant) return
    setSaving(true); setError('')
    const { id, ...rest } = dialog
    const payload = { ...rest, tenant_id: tenant.id }
    const { error: e } = id
      ? await supabase.from('inquilini').update(payload).eq('id', id)
      : await supabase.from('inquilini').insert(payload)
    setSaving(false)
    if (e) { setError(e.message); return }
    setDialog(null); load()
  }

  const filtered = items.filter((i) =>
    `${i.nome} ${i.cognome} ${i.email ?? ''} ${i.telefono_whatsapp ?? ''}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <PageHeader
        title="Inquilini"
        description="Gestisci gli inquilini e il loro collegamento al bot"
        action={
          <button
            onClick={() => setDialog({ lingua: 'it', attivo: true })}
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
                <th className="px-4 py-3 text-left">Unità</th>
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
                  <td className="px-4 py-3 text-gray-500">{(i.unita as { slug: string } | null)?.slug ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={i.telegram_user_id ? 'success' : 'warning'}>
                      {i.telegram_user_id ? 'Collegato' : 'Non collegato'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={i.attivo ? 'success' : 'default'}>{i.attivo ? 'Attivo' : 'Inattivo'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setDialog(i)} className="text-xs text-brand-600 hover:underline">Modifica</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">Nessun inquilino trovato</td></tr>
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
              <Field label="Nome"><input value={dialog.nome ?? ''} onChange={(e) => setDialog({ ...dialog, nome: e.target.value })} className={INPUT} /></Field>
              <Field label="Cognome"><input value={dialog.cognome ?? ''} onChange={(e) => setDialog({ ...dialog, cognome: e.target.value })} className={INPUT} /></Field>
              <Field label="Telefono (E.164)"><input value={dialog.telefono_whatsapp ?? ''} onChange={(e) => setDialog({ ...dialog, telefono_whatsapp: e.target.value })} placeholder="+39333..." className={INPUT} /></Field>
              <Field label="Email"><input type="email" value={dialog.email ?? ''} onChange={(e) => setDialog({ ...dialog, email: e.target.value })} className={INPUT} /></Field>
              <Field label="Codice fiscale"><input value={dialog.codice_fiscale ?? ''} onChange={(e) => setDialog({ ...dialog, codice_fiscale: e.target.value })} className={INPUT} /></Field>
              <Field label="Lingua">
                <select value={dialog.lingua ?? 'it'} onChange={(e) => setDialog({ ...dialog, lingua: e.target.value as 'it' | 'en' })} className={INPUT}>
                  <option value="it">Italiano</option>
                  <option value="en">English</option>
                </select>
              </Field>
              <Field label="Unità">
                <select value={dialog.unita_id ?? ''} onChange={(e) => setDialog({ ...dialog, unita_id: e.target.value || null })} className={INPUT}>
                  <option value="">— Nessuna —</option>
                  {unita.map((u) => <option key={u.id} value={u.id}>{u.slug}</option>)}
                </select>
              </Field>
              <Field label="Data ingresso"><input type="date" value={dialog.data_ingresso ?? ''} onChange={(e) => setDialog({ ...dialog, data_ingresso: e.target.value || null })} className={INPUT} /></Field>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={dialog.attivo ?? true} onChange={(e) => setDialog({ ...dialog, attivo: e.target.checked })} />
              Attivo
            </label>
            {dialog.telegram_user_id && (
              <p className="mt-2 text-xs text-green-600">✅ Telegram collegato: {dialog.telegram_user_id}</p>
            )}
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setDialog(null)} className="px-4 py-2 text-sm text-gray-600">Annulla</button>
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
