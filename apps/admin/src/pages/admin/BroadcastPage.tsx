import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/PageHeader'
import { sendBroadcast } from '../../lib/api'
import type { AvisoBroadcast, Inquilino, Proprieta } from '@tenantbot/db'

const INPUT =
  'rounded-lg border border-gray-300 px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'
const LABEL = 'block text-sm font-medium text-gray-700 mb-1'

type InquilinoExt = Inquilino & { unita?: { proprieta_id: string } | null }
type BroadcastRow = AvisoBroadcast & { proprieta?: { nome: string } | null }

export function BroadcastPage() {
  const { tenant } = useAuth()

  const [inquilini, setInquilini] = useState<InquilinoExt[]>([])
  const [proprieta, setProprietaList] = useState<Proprieta[]>([])
  const [history, setHistory] = useState<BroadcastRow[]>([])

  const [proprietaId, setProprietaId] = useState<string>('')
  const [contenutoIt, setContenutoIt] = useState('')
  const [contenutoEn, setContenutoEn] = useState('')
  const [sending, setSending] = useState(false)

  // Live counter — who will receive the message
  const destinatari = inquilini.filter((i) => {
    if (!i.telegram_user_id) return false
    if (proprietaId) return i.unita?.proprieta_id === proprietaId
    return true
  })
  const hasEnglishTenants = destinatari.some((i) => i.lingua === 'en')
  const canSend = destinatari.length > 0 && contenutoIt.trim().length >= 5 && !sending

  async function load() {
    if (!tenant) return
    const [inqRes, propRes, histRes] = await Promise.all([
      supabase
        .from('inquilini')
        .select('*, unita:unita_id(proprieta_id)')
        .eq('tenant_id', tenant.id)
        .eq('attivo', true),
      supabase.from('proprieta').select('*').eq('tenant_id', tenant.id).order('nome'),
      supabase
        .from('avvisi_broadcast')
        .select('*, proprieta:proprieta_id(nome)')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ])
    setInquilini((inqRes.data ?? []) as InquilinoExt[])
    setProprietaList(propRes.data ?? [])
    setHistory((histRes.data ?? []) as BroadcastRow[])
  }

  useEffect(() => {
    load()
  }, [tenant])

  async function handleSend() {
    if (!tenant || !canSend) return
    setSending(true)
    try {
      const result = await sendBroadcast(
        tenant.id,
        contenutoIt,
        contenutoEn || undefined,
        proprietaId || undefined,
      )
      if (!result.ok) {
        toast.error(result.error ?? 'Errore durante l\'invio')
      } else {
        const n = result.sent_count ?? 0
        toast.success(`Messaggio inviato a ${n} inquilin${n === 1 ? 'o' : 'i'} ✅`)
        setContenutoIt('')
        setContenutoEn('')
        setProprietaId('')
        load()
      }
    } catch {
      toast.error('Errore di rete. Riprova.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Broadcast"
        description="Invia messaggi Telegram a tutti gli inquilini o a una proprietà specifica"
      />

      <div className="p-8 space-y-8">
        {/* ── Compose ── */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Nuovo messaggio
          </h2>

          {/* Recipient select */}
          <div>
            <label className={LABEL}>Destinatari</label>
            <select
              value={proprietaId}
              onChange={(e) => setProprietaId(e.target.value)}
              className={INPUT}
            >
              <option value="">Tutti gli inquilini</option>
              {proprieta.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Live counter */}
          <div
            className={`rounded-lg px-4 py-3 text-sm font-medium border ${
              destinatari.length > 0
                ? 'bg-brand-50 text-brand-700 border-brand-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            {destinatari.length > 0 ? (
              <>
                📨 <strong>{destinatari.length}</strong> inquilin
                {destinatari.length === 1 ? 'o' : 'i'} ricevier
                {destinatari.length === 1 ? 'à' : 'anno'} questo messaggio
              </>
            ) : (
              <>
                ⚠️ Nessun inquilino con Telegram collegato
                {proprietaId ? ' in questa proprietà' : ''}.{' '}
                <span className="font-normal">
                  Collega i profili Telegram dalla pagina{' '}
                  <a href="/inquilini" className="underline">
                    Inquilini
                  </a>
                  .
                </span>
              </>
            )}
          </div>

          {/* Message IT */}
          <div>
            <label className={LABEL}>
              Messaggio in italiano <span className="text-red-500">*</span>
            </label>
            <textarea
              value={contenutoIt}
              onChange={(e) => setContenutoIt(e.target.value)}
              rows={4}
              placeholder="Gentili inquilini, vi informiamo che..."
              className={INPUT}
            />
          </div>

          {/* Message EN — shown only if ≥1 English tenant is in the selection */}
          {hasEnglishTenants && (
            <div>
              <label className={LABEL}>
                Messaggio in inglese{' '}
                <span className="text-xs font-normal text-gray-400 ml-1">
                  — opzionale, inviato agli inquilini con lingua EN
                </span>
              </label>
              <textarea
                value={contenutoEn}
                onChange={(e) => setContenutoEn(e.target.value)}
                rows={4}
                placeholder="Dear tenants, we would like to inform you that..."
                className={INPUT}
              />
            </div>
          )}

          {/* Send button */}
          <div className="flex items-center gap-4 pt-1">
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {sending ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Invio in corso...
                </>
              ) : (
                <>📨 Invia messaggio</>
              )}
            </button>
            {destinatari.length === 0 && (
              <span className="text-sm text-amber-600">Nessun destinatario disponibile</span>
            )}
          </div>
        </div>

        {/* ── History ── */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Storico invii
            </h2>
          </div>

          {history.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              Nessun broadcast ancora inviato.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {['Data', 'Destinatari', 'Messaggio', 'Inviati'].map((h) => (
                      <th
                        key={h}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {history.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(b.created_at).toLocaleDateString('it-IT', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {(b.proprieta as { nome: string } | null)?.nome ?? (
                          <span className="text-gray-400 italic">Tutti</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 max-w-xs">
                        <span
                          className="block truncate"
                          title={b.contenuto_it}
                        >
                          {b.contenuto_it.length > 80
                            ? b.contenuto_it.slice(0, 80) + '…'
                            : b.contenuto_it}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                          {b.sent_count}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
