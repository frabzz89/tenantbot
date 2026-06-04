import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { TelegramIcon, WhatsAppIcon } from '../../components/icons'
import { toast } from 'sonner'
import type { Proprieta } from '@tenantbot/db'

const API_URL = import.meta.env.VITE_API_URL as string ?? ''

type Step = 1 | 2 | 3 | 4

interface TelegramBotInfo {
  username: string
  first_name: string
}

export function OnboardingPage() {
  const { tenant, user, loading: authLoading } = useAuth()
  const location = useLocation()
  const locationTenantId = (location.state as { tenant_id?: string } | null)?.tenant_id

  // Auto-created tenant ID (fallback for accounts whose signup API call failed due to CORS)
  const [autoTenantId, setAutoTenantId] = useState<string | null>(null)
  const creatingTenantRef = useRef(false)

  const tenantId = tenant?.id ?? locationTenantId ?? autoTenantId
  const [step, setStep] = useState<Step>(1)

  // Step 2 — Prima proprietà
  const [nomePropriety, setNomePropriety] = useState('')
  const [indirizzoPropriety, setIndirizzoPropriety] = useState('')
  const [cittaPropriety, setCittaPropriety] = useState('')

  // Step 3 — Bot config
  const [botToken, setBotToken] = useState('')
  const [botInfo, setBotInfo] = useState<TelegramBotInfo | null>(null)
  const [tokenError, setTokenError] = useState('')
  const [validating, setValidating] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState('')
  const validateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Step 4 — Primo inquilino
  const [nomeInq, setNomeInq] = useState('')
  const [cognomeInq, setCognomeInq] = useState('')
  const [telefonoInq, setTelefonoInq] = useState('')
  const [propList, setPropList] = useState<Proprieta[]>([])
  const [selectedPropIds, setSelectedPropIds] = useState<string[]>([])

  const [loading, setLoading] = useState(false)

  // Auto-create tenant if user is logged in but has no tenant record
  // (handles accounts where the signup API call failed silently due to CORS)
  useEffect(() => {
    if (authLoading || tenantId || !user || creatingTenantRef.current) return
    creatingTenantRef.current = true
    fetch(`${API_URL}/api/admin/tenant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user.id,
        nome: user.email?.split('@')[0] ?? 'Il mio studio',
        email: user.email ?? '',
      }),
    })
      .then((r) => r.json())
      .then((data: { ok?: boolean; tenant_id?: string }) => {
        if (data.ok && data.tenant_id) setAutoTenantId(data.tenant_id)
      })
      .catch(() => { /* silently ignore — user will see error when they click Avanti */ })
      .finally(() => { creatingTenantRef.current = false })
  }, [authLoading, tenantId, user])

  // Load proprieta list when entering Step 4 (to associate the first tenant)
  useEffect(() => {
    if (step !== 4 || !tenantId) return
    supabase.from('proprieta').select('*').eq('attivo', true).order('nome')
      .then(({ data }) => {
        const list = data ?? []
        setPropList(list)
        // Pre-select all properties (usually just 1 from step 2)
        setSelectedPropIds(list.map((p) => p.id))
      })
  }, [step, tenantId])

  // Validate Telegram token in real-time (debounced)
  useEffect(() => {
    if (validateTimer.current) clearTimeout(validateTimer.current)
    setBotInfo(null)
    setTokenError('')

    const trimmed = botToken.trim()
    // Telegram tokens look like: 1234567890:ABCdef...
    if (!trimmed || !trimmed.includes(':') || trimmed.length < 30) return

    setValidating(true)
    validateTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.telegram.org/bot${trimmed}/getMe`)
        const data = await res.json()
        if (data.ok) {
          setBotInfo({ username: data.result.username, first_name: data.result.first_name })
          setTokenError('')
        } else {
          setTokenError('Token non valido — verifica di averlo copiato correttamente da BotFather')
        }
      } catch {
        setTokenError('Impossibile verificare il token. Controlla la connessione.')
      } finally {
        setValidating(false)
      }
    }, 600)
  }, [botToken])

  async function savePropriety() {
    if (!nomePropriety) return
    if (!tenantId) { toast.error('Sessione non trovata — ricarica la pagina (F5)'); return }
    setLoading(true)
    const { error } = await supabase.from('proprieta').insert({
      tenant_id: tenantId,
      nome: nomePropriety,
      indirizzo: indirizzoPropriety,
      citta: cittaPropriety,
      tipo: 'residenziale',
      attivo: true,
    })
    setLoading(false)
    if (error) { toast.error('Errore salvataggio: ' + error.message); return }
    setStep(3)
  }

  async function saveBotConfig() {
    if (!botToken.trim() || !botInfo) return
    if (!tenantId) { toast.error('Sessione non trovata — ricarica la pagina (F5)'); return }
    setLoading(true)

    try {
      // Single API call — saves config AND registers webhook server-side
      setLoadingStatus('Attivazione bot...')
      let res: Response
      try {
        res = await fetch(`${API_URL}/api/admin/activate-bot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_id: tenantId,
            bot_token: botToken.trim(),
            nome_bot: botInfo.first_name,
          }),
        })
      } catch {
        throw new Error(`Impossibile raggiungere l'API (${API_URL || 'URL non configurata'}). Verifica VITE_API_URL nelle env di Vercel.`)
      }
      const data = await res.json()
      if (!data.ok) throw new Error(data.error ?? 'Errore attivazione bot')

      setLoadingStatus('')
      toast.success(`Bot @${botInfo.username} attivato!`)
      setStep(4)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore imprevisto')
    } finally {
      setLoading(false)
      setLoadingStatus('')
    }
  }

  async function saveInquilino() {
    if (!nomeInq || !cognomeInq) return
    const tid = tenantId
    if (!tid) { toast.error('Sessione non trovata — ricarica la pagina (F5)'); return }
    setLoading(true)

    // 1. Create inquilino
    const { data: inqData, error } = await supabase
      .from('inquilini')
      .insert({ tenant_id: tid, nome: nomeInq, cognome: cognomeInq, telefono_whatsapp: telefonoInq || null, lingua: 'it', attivo: true })
      .select('id')
      .single()

    if (error || !inqData) {
      setLoading(false)
      toast.error('Errore salvataggio: ' + (error?.message ?? 'errore sconosciuto'))
      return
    }

    // 2. Associate with selected properties (via junction table)
    if (selectedPropIds.length > 0) {
      await supabase.from('inquilino_proprieta').insert(
        selectedPropIds.map((pid) => ({ tenant_id: tid, inquilino_id: inqData.id, proprieta_id: pid }))
      )
    }

    setLoading(false)
    toast.success('Setup completato! Benvenuto in TenantBot 🎉')
    // Hard reload: forces useAuth to reinitialize so AdminLayout never sees tenant=null
    window.location.replace('/dashboard')
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-400">Caricamento account...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className={`flex-1 h-2 rounded-full mx-0.5 transition-colors ${s <= step ? 'bg-brand-600' : 'bg-gray-200'}`} />
            ))}
          </div>
          <div className="text-center text-sm text-gray-500">Step {step} di 4</div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">

          {/* Step 1 — Benvenuto */}
          {step === 1 && (
            <div>
              <h1 className="text-xl font-semibold mb-1">Benvenuto in TenantBot! 👋</h1>
              <p className="text-sm text-gray-500 mb-6">Ti guidiamo nella configurazione iniziale in pochi minuti.</p>
              <div className="space-y-4 text-sm text-gray-700">
                {[
                  { n: 1, text: 'Profilo azienda — il tuo account è già creato', done: true },
                  { n: 2, text: 'Aggiungi la tua prima proprietà' },
                  { n: 3, text: 'Configura il bot Telegram (2 minuti con il telefono)' },
                  { n: 4, text: 'Aggiungi il primo inquilino' },
                ].map(({ n, text, done }) => (
                  <div key={n} className="flex gap-3 items-start">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${done ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      {done ? '✓' : n}
                    </div>
                    <div className={done ? 'text-gray-400 line-through' : ''}>{text}</div>
                  </div>
                ))}
              </div>
              <button onClick={() => setStep(2)} className="mt-6 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
                Iniziamo →
              </button>
            </div>
          )}

          {/* Step 2 — Prima proprietà */}
          {step === 2 && (
            <div>
              <h2 className="text-lg font-semibold mb-1">🏢 Prima proprietà</h2>
              <p className="text-sm text-gray-500 mb-4">Aggiungi il tuo primo edificio o immobile.</p>
              <div className="space-y-3">
                <Field label="Nome edificio *"><input value={nomePropriety} onChange={(e) => setNomePropriety(e.target.value)} className={INPUT} placeholder="Es. Via Roma 10" /></Field>
                <Field label="Indirizzo"><input value={indirizzoPropriety} onChange={(e) => setIndirizzoPropriety(e.target.value)} className={INPUT} /></Field>
                <Field label="Città"><input value={cittaPropriety} onChange={(e) => setCittaPropriety(e.target.value)} className={INPUT} /></Field>
              </div>
              <div className="mt-5 flex gap-2">
                <button onClick={() => setStep(1)} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Indietro</button>
                <button onClick={savePropriety} disabled={loading || !nomePropriety} className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                  {loading ? 'Salvataggio...' : 'Avanti →'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Bot Telegram */}
          {step === 3 && (
            <div>
              <h2 className="text-lg font-semibold mb-1">🤖 Configura il bot</h2>
              <p className="text-sm text-gray-500 mb-4">Hai bisogno del telefono con Telegram — ci vogliono circa 2 minuti.</p>

              {/* Channel selector */}
              <div className="flex gap-2 mb-4">
                <button className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-brand-500 bg-brand-50 py-2 text-sm font-medium text-brand-700">
                  <TelegramIcon size={18} /> Telegram
                </button>
                <div className="flex-1 relative">
                  <button disabled className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-400 cursor-not-allowed">
                    <WhatsAppIcon size={18} /> WhatsApp
                  </button>
                  <span className="absolute -top-2 right-2 text-[10px] bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 font-semibold">Presto</span>
                </div>
              </div>

              {/* BotFather instructions */}
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 mb-4 space-y-2">
                <p className="text-xs font-semibold text-blue-800 mb-1">Come creare il bot (una volta sola):</p>
                <ol className="text-xs text-blue-700 space-y-1.5 list-none">
                  <li className="flex gap-2"><span className="font-bold shrink-0">1.</span><span>Apri Telegram sul telefono</span></li>
                  <li className="flex gap-2"><span className="font-bold shrink-0">2.</span><span>Cerca <strong>@BotFather</strong> e aprilo</span></li>
                  <li className="flex gap-2"><span className="font-bold shrink-0">3.</span><span>Invia il comando: <code className="bg-blue-100 px-1 rounded">/newbot</code></span></li>
                  <li className="flex gap-2"><span className="font-bold shrink-0">4.</span><span>Scegli un nome (es. <em>"Palazzo Rossi Assistente"</em>) e uno username che finisce in <em>"bot"</em></span></li>
                  <li className="flex gap-2"><span className="font-bold shrink-0">5.</span><span>BotFather ti darà un token — copialo e incollalo qui sotto</span></li>
                </ol>
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors"
                >
                  ↗ Apri @BotFather in Telegram
                </a>
              </div>

              {/* Token input with live validation */}
              <Field label="Token del bot *">
                <div className="relative">
                  <input
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    className={`${INPUT} pr-8 ${botInfo ? 'border-green-400 ring-1 ring-green-300' : tokenError ? 'border-red-400' : ''}`}
                    placeholder="1234567890:ABCdefGhIjKlmn..."
                  />
                  {validating && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs animate-pulse">...</span>
                  )}
                  {botInfo && !validating && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-green-500 text-sm">✓</span>
                  )}
                </div>
              </Field>

              {/* Live feedback */}
              {botInfo && (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                  <span className="text-green-600 text-sm">✓</span>
                  <span className="text-xs text-green-700">
                    Bot rilevato: <strong>{botInfo.first_name}</strong> (@{botInfo.username})
                  </span>
                </div>
              )}
              {tokenError && (
                <p className="mt-2 text-xs text-red-600">{tokenError}</p>
              )}

              <div className="mt-5 flex gap-2">
                <button onClick={() => setStep(2)} disabled={loading} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">Indietro</button>
                <button
                  onClick={saveBotConfig}
                  disabled={loading || !botInfo}
                  className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {loading ? (loadingStatus || 'Attivazione...') : 'Attiva bot →'}
                </button>
              </div>
              {!botInfo && botToken.length > 5 && !validating && !tokenError && (
                <p className="mt-2 text-center text-xs text-gray-400">In attesa di un token valido...</p>
              )}
            </div>
          )}

          {/* Step 4 — Primo inquilino */}
          {step === 4 && (
            <div>
              <h2 className="text-lg font-semibold mb-1">👤 Primo inquilino</h2>
              <p className="text-sm text-gray-500 mb-4">Aggiungi almeno un inquilino per testare il bot.</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nome *"><input value={nomeInq} onChange={(e) => setNomeInq(e.target.value)} className={INPUT} /></Field>
                  <Field label="Cognome *"><input value={cognomeInq} onChange={(e) => setCognomeInq(e.target.value)} className={INPUT} /></Field>
                </div>
                <Field label="Telefono (es. +39333...)">
                  <input value={telefonoInq} onChange={(e) => setTelefonoInq(e.target.value)} className={INPUT} placeholder="+39333..." />
                </Field>

                {/* Property association */}
                {propList.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">
                      Proprietà associate
                    </label>
                    <div className="space-y-1.5">
                      {propList.map((p) => (
                        <label key={p.id} className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 cursor-pointer hover:bg-gray-50 select-none">
                          <input
                            type="checkbox"
                            checked={selectedPropIds.includes(p.id)}
                            onChange={() => setSelectedPropIds((prev) =>
                              prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                            )}
                            className="accent-brand-600 h-4 w-4 shrink-0"
                          />
                          <span className="text-sm text-gray-800 font-medium">{p.nome}</span>
                          {p.indirizzo && <span className="ml-auto text-xs text-gray-400">{p.indirizzo}</span>}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-5 flex gap-2">
                <button onClick={() => setStep(3)} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600">Indietro</button>
                <button onClick={saveInquilino} disabled={loading || !nomeInq || !cognomeInq} className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                  {loading ? 'Salvataggio...' : 'Completa setup 🎉'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

const INPUT = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>{children}</div>
}
