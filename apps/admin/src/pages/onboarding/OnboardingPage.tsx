import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { toast } from 'sonner'

type Step = 1 | 2 | 3 | 4

export function OnboardingPage() {
  const { tenant, user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // Fallback: tenant_id passed via router state right after signup
  const locationTenantId = (location.state as { tenant_id?: string } | null)?.tenant_id
  const tenantId = tenant?.id ?? locationTenantId
  const [step, setStep] = useState<Step>(1)

  // Step 2 — Prima proprietà
  const [nomePropriety, setNomePropriety] = useState('')
  const [indirizzoPropriety, setIndirizzoPropriety] = useState('')
  const [cittaPropriety, setCittaPropriety] = useState('')

  // Step 3 — Bot config
  const [canale, setCanale] = useState<'telegram' | 'whatsapp'>('telegram')
  const [botToken, setBotToken] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')

  // Step 4 — Primo inquilino
  const [nomeInq, setNomeInq] = useState('')
  const [cognomeInq, setCognomeInq] = useState('')
  const [telefonoInq, setTelefonoInq] = useState('')

  const [loading, setLoading] = useState(false)

  async function savePropriety() {
    if (!nomePropriety) return
    if (!tenantId) { toast.error('Sessione non trovata — ricarica la pagina (F5)'); return }
    setLoading(true)
    const { error } = await supabase.from('proprieta').insert({ tenant_id: tenantId, nome: nomePropriety, indirizzo: indirizzoPropriety, citta: cittaPropriety, tipo: 'residenziale', attivo: true })
    setLoading(false)
    if (error) { toast.error('Errore salvataggio: ' + error.message); return }
    setStep(3)
  }

  async function saveBotConfig() {
    if (!botToken) return
    if (!tenantId) { toast.error('Sessione non trovata — ricarica la pagina (F5)'); return }
    setLoading(true)
    const { error } = await supabase.from('bot_configurazioni').upsert({
      tenant_id: tenantId,
      canale,
      bot_token: botToken,
      webhook_secret: webhookSecret || null,
      nome_bot: tenant?.nome ?? 'TenantBot',
      lingua_default: 'it',
      attivo: true,
    }, { onConflict: 'tenant_id,canale' })
    setLoading(false)
    if (error) { toast.error('Errore salvataggio: ' + error.message); return }
    setStep(4)
  }

  async function saveInquilino() {
    if (!nomeInq || !cognomeInq) return
    if (!tenantId) { toast.error('Sessione non trovata — ricarica la pagina (F5)'); return }
    setLoading(true)
    const { error } = await supabase.from('inquilini').insert({
      tenant_id: tenantId,
      nome: nomeInq,
      cognome: cognomeInq,
      telefono_whatsapp: telefonoInq || null,
      lingua: 'it',
      attivo: true,
    })
    setLoading(false)
    if (error) { toast.error('Errore salvataggio: ' + error.message); return }
    toast.success('Setup completato! Benvenuto in TenantBot 🎉')
    navigate('/dashboard')
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
          {step === 1 && (
            <div>
              <h1 className="text-xl font-semibold mb-1">Benvenuto in TenantBot! 👋</h1>
              <p className="text-sm text-gray-500 mb-6">Ti guidiamo nella configurazione iniziale in pochi minuti.</p>
              <div className="space-y-4 text-sm text-gray-700">
                <div className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">1</div>
                  <div><strong>Profilo azienda</strong> — il tuo account è già creato</div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-bold shrink-0">2</div>
                  <div>Aggiungi la tua prima proprietà</div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-bold shrink-0">3</div>
                  <div>Configura il bot (Telegram o WhatsApp)</div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-bold shrink-0">4</div>
                  <div>Aggiungi il primo inquilino</div>
                </div>
              </div>
              <button onClick={() => setStep(2)} className="mt-6 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
                Iniziamo →
              </button>
            </div>
          )}

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

          {step === 3 && (
            <div>
              <h2 className="text-lg font-semibold mb-1">🤖 Configura il bot</h2>
              <p className="text-sm text-gray-500 mb-4">Scegli il canale e inserisci le credenziali.</p>
              <div className="flex gap-2 mb-4">
                {(['telegram', 'whatsapp'] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCanale(c)}
                    className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${canale === c ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {c === 'telegram' ? '✈️ Telegram' : '📱 WhatsApp'}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {canale === 'telegram' ? (
                  <>
                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700">
                      1. Apri Telegram e cerca <strong>@BotFather</strong><br />
                      2. Invia <code>/newbot</code> e segui le istruzioni<br />
                      3. Copia il token e incollalo qui sotto
                    </div>
                    <Field label="Bot Token *"><input value={botToken} onChange={(e) => setBotToken(e.target.value)} className={INPUT} placeholder="8888179292:AAFYnVb..." /></Field>
                    <Field label="Webhook Secret (consigliato)"><input value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} className={INPUT} placeholder="stringa casuale 32+ char" /></Field>
                  </>
                ) : (
                  <>
                    <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-xs text-green-700">
                      1. Vai su <strong>Meta for Developers</strong> → crea un'app WhatsApp Business<br />
                      2. Copia il <strong>Phone Number ID</strong> e l'<strong>Access Token</strong>
                    </div>
                    <Field label="Phone Number ID *"><input value={botToken} onChange={(e) => setBotToken(e.target.value)} className={INPUT} /></Field>
                    <Field label="Webhook Verify Token *"><input value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} className={INPUT} /></Field>
                  </>
                )}
              </div>
              <div className="mt-5 flex gap-2">
                <button onClick={() => setStep(2)} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600">Indietro</button>
                <button onClick={saveBotConfig} disabled={loading || !botToken} className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                  {loading ? 'Salvataggio...' : 'Avanti →'}
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="text-lg font-semibold mb-1">👤 Primo inquilino</h2>
              <p className="text-sm text-gray-500 mb-4">Aggiungi almeno un inquilino per testare il bot.</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nome *"><input value={nomeInq} onChange={(e) => setNomeInq(e.target.value)} className={INPUT} /></Field>
                  <Field label="Cognome *"><input value={cognomeInq} onChange={(e) => setCognomeInq(e.target.value)} className={INPUT} /></Field>
                </div>
                <Field label="Telefono E.164 (es. +39333...)"><input value={telefonoInq} onChange={(e) => setTelefonoInq(e.target.value)} className={INPUT} placeholder="+39333..." /></Field>
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
