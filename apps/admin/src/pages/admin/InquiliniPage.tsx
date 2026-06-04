import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/PageHeader'
import { Badge } from '../../components/Badge'
import type { Inquilino } from '@tenantbot/db'

// Unit option shown in the dropdown
type UnitaOption = {
  id: string
  display: string    // e.g. "Int. 2A — Palazzina Rossi"
  prop_nome: string
}

type InquilinoRow = Inquilino & {
  _unitaNome: string  // display label for the unit column
}

export function InquiliniPage() {
  const { tenant } = useAuth()
  const [items, setItems] = useState<InquilinoRow[]>([])
  const [unitaOptions, setUnitaOptions] = useState<UnitaOption[]>([])
  const [dialog, setDialog] = useState<Partial<Inquilino> | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [botUsername, setBotUsername] = useState<string | null>(null)

  // ── load ────────────────────────────────────────────────────────────────────

  async function load() {
    if (!tenant) return
    const [{ data: inqData }, { data: unitaRaw }, { data: botConfig }] = await Promise.all([
      supabase.from('inquilini').select('*').order('cognome'),
      supabase.from('unita')
        .select('id, interno, slug, proprieta:proprieta_id(nome)')
        .neq('stato', 'archiviata')
        .order('slug'),
      supabase.from('bot_configurazioni')
        .select('bot_username')
        .eq('tenant_id', tenant.id)
        .eq('canale', 'telegram')
        .maybeSingle(),
    ])
    setBotUsername((botConfig as { bot_username?: string | null } | null)?.bot_username ?? null)

    // Build unit options (Supabase returns the join as object, cast through unknown)
    type RawUnita = { id: string; interno: string | null; slug: string; proprieta: { nome: string } | null }
    const rawUnits = (unitaRaw ?? []) as unknown as RawUnita[]

    const options: UnitaOption[] = rawUnits.map((u) => ({
      id: u.id,
      display: `${u.interno ? `Int. ${u.interno}` : u.slug}${u.proprieta?.nome ? ` — ${u.proprieta.nome}` : ''}`,
      prop_nome: u.proprieta?.nome ?? '',
    }))
    setUnitaOptions(options)

    const unitaMap = Object.fromEntries(options.map((o) => [o.id, o.display]))

    const enriched: InquilinoRow[] = (inqData ?? []).map((inq) => ({
      ...(inq as Inquilino),
      _unitaNome: inq.unita_id ? (unitaMap[inq.unita_id] ?? '—') : '—',
    }))
    setItems(enriched)
  }

  useEffect(() => { load() }, [tenant])

  // ── dialog helpers ───────────────────────────────────────────────────────────

  function openDialog(inq: InquilinoRow | null) {
    if (!inq) {
      setDialog({ lingua: 'it', attivo: true })
    } else {
      const { _unitaNome: _n, ...rest } = inq
      setDialog(rest)
    }
  }

  // ── save ─────────────────────────────────────────────────────────────────────

  async function save() {
    if (!dialog || !tenant) return
    setSaving(true); setError('')

    const { id, ...fields } = dialog
    const payload = { ...fields, tenant_id: tenant.id }

    const { error: e } = id
      ? await supabase.from('inquilini').update(payload).eq('id', id)
      : await supabase.from('inquilini').insert(payload)

    setSaving(false)
    if (e) { setError(e.message); return }
    setDialog(null)
    load()
  }

  // ── unlink telegram ──────────────────────────────────────────────────────────

  async function unlinkTelegram(id: string) {
    await supabase.from('inquilini').update({ telegram_user_id: null }).eq('id', id)
    load()
  }

  // ── copy telegram deep-link ───────────────────────────────────────────────
  // Il link porta l'inquilino direttamente al bot già collegato al suo profilo.
  // Formato: https://t.me/BOT_USERNAME?start=inq_UUID_NO_DASHES

  async function copyTelegramLink(inq: InquilinoRow) {
    if (!botUsername) {
      toast.error('Username bot non disponibile. Vai in Bot Config e salva la configurazione.')
      return
    }
    const id = inq.id.replace(/-/g, '')
    const link = `https://t.me/${botUsername}?start=inq_${id}`
    try {
      await navigator.clipboard.writeText(link)
      toast.success(`Link copiato! Invialo a ${inq.nome} ${inq.cognome} via WhatsApp o email.`)
    } catch {
      // fallback per browser senza clipboard API
      toast.info(`Link: ${link}`)
    }
  }

  // ── filter ───────────────────────────────────────────────────────────────────

  const filtered = items.filter((i) =>
    `${i.nome} ${i.cognome} ${i.email ?? ''} ${i.telefono_whatsapp ?? ''}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  // ── render ───────────────────────────────────────────────────────────────────

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
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate" title={i._unitaNome}>{i._unitaNome}</td>
                  <td className="px-4 py-3">
                    {i.telegram_user_id ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="success">Collegato</Badge>
                        <button
                          onClick={() => unlinkTelegram(i.id)}
                          className="text-xs text-gray-400 hover:text-red-500 leading-none"
                          title="Scollega Telegram"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge variant="warning">Non collegato</Badge>
                        <button
                          onClick={() => copyTelegramLink(i)}
                          className="text-xs text-brand-600 hover:text-brand-800 font-medium leading-none"
                          title="Copia link da inviare all'inquilino"
                        >
                          🔗 Link
                        </button>
                      </div>
                    )}
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

      {/* ── Dialog ── */}
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
              <Field label="Telefono (E.164) *">
                <input
                  value={dialog.telefono_whatsapp ?? ''}
                  onChange={(e) => setDialog({ ...dialog, telefono_whatsapp: e.target.value })}
                  placeholder="+39333..."
                  className={INPUT}
                />
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

            {/* Unit picker */}
            <div className="mt-4">
              <Field label="Unità assegnata">
                <select
                  value={dialog.unita_id ?? ''}
                  onChange={(e) => setDialog({ ...dialog, unita_id: e.target.value || null })}
                  className={INPUT}
                >
                  <option value="">— Nessuna unità —</option>
                  {unitaOptions.map((u) => (
                    <option key={u.id} value={u.id}>{u.display}</option>
                  ))}
                </select>
              </Field>
              {unitaOptions.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">
                  Nessuna unità disponibile. Crea prima le unità in <strong>Unità</strong>.
                </p>
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

            {/* Telegram manual linking */}
            <div className="mt-4">
              <Field label="Telegram User ID (collegamento manuale)">
                <input
                  value={dialog.telegram_user_id ?? ''}
                  onChange={(e) => setDialog({ ...dialog, telegram_user_id: e.target.value || null })}
                  className={INPUT}
                  placeholder="es. 123456789"
                />
              </Field>
              <p className="mt-1 text-xs text-gray-400">
                Per trovarlo: scrivi{' '}
                <code className="bg-gray-100 px-1 rounded">/start</code>{' '}
                a <strong>@userinfobot</strong> su Telegram.{' '}
                Lascia vuoto per usare il collegamento automatico via numero di telefono.
              </p>
            </div>
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
