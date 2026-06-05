import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const ADMIN_URL = import.meta.env.VITE_ADMIN_URL as string ?? 'https://app.tenantbot.it'

// ─── Data ────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: '📄',
    title: 'Contratti RAG',
    desc: 'Il bot legge il PDF del contratto e risponde a qualsiasi domanda: canone, scadenza, clausole, cauzione. Ogni inquilino vede solo il suo.',
  },
  {
    icon: '⚖️',
    title: 'Knowledge base normativa',
    desc: 'Carica regolamenti, legge 431/98, cedolare secca. Il bot risponde con la normativa corretta, dando sempre priorità al contratto individuale.',
  },
  {
    icon: '🔧',
    title: 'Ticket manutenzione',
    desc: "Gli inquilini segnalano guasti via chat. Il bot classifica l'urgenza, notifica l'admin per le emergenze e tiene traccia dello stato.",
  },
  {
    icon: '📢',
    title: 'Broadcast',
    desc: 'Invia comunicazioni a tutti gli inquilini o a una proprietà specifica in un clic dal backoffice.',
  },
  {
    icon: '🌐',
    title: 'Multilingua',
    desc: "Imposta la lingua per ogni inquilino: italiano o inglese. Il bot risponde sempre nella lingua dell'inquilino.",
  },
  {
    icon: '🔒',
    title: 'Multi-tenant & sicuro',
    desc: 'Ogni property manager vede solo i propri dati. Row Level Security Supabase garantisce isolamento totale tra clienti.',
  },
]

// ─── Step Animations ─────────────────────────────────────────────────────────

const BF_MSGS = [
  { from: 'user', text: '/newbot' },
  { from: 'bot',  text: 'Come si chiama il bot?' },
  { from: 'user', text: 'Palazzi Milano Bot' },
  { from: 'bot',  text: 'Username? (deve finire in Bot)' },
  { from: 'user', text: 'palazzimilano_bot' },
  { from: 'bot',  text: '✅ Fatto! Ecco il token:' },
  { from: 'token', text: '7432156:AAHdqTcvCH1v…  📋' },
] as const

function BotFatherAnimation() {
  const [visible, setVisible] = useState(0)
  useEffect(() => {
    const t = setTimeout(
      () => setVisible((v) => (v >= BF_MSGS.length ? 0 : v + 1)),
      visible >= BF_MSGS.length ? 2500 : 850,
    )
    return () => clearTimeout(t)
  }, [visible])

  return (
    <div className="flex flex-col" style={{ height: 232 }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 shrink-0" style={{ background: '#2AABEE' }}>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
          style={{ background: '#1a96d4' }}
        >
          BF
        </div>
        <div>
          <div className="text-white text-xs font-semibold leading-none">@BotFather</div>
          <div className="text-white/70 text-[9px] leading-none mt-0.5">online</div>
        </div>
      </div>
      {/* Messages */}
      <div className="flex-1 overflow-hidden px-2 py-2 space-y-1.5" style={{ background: '#DAECF8' }}>
        {BF_MSGS.slice(0, visible).map((msg, i) =>
          msg.from === 'token' ? (
            <div key={i} className="mx-2">
              <div className="rounded-xl border border-yellow-300 bg-yellow-50 px-3 py-2 text-[10px] font-mono text-yellow-900 text-center shadow-sm">
                {msg.text}
              </div>
            </div>
          ) : (
            <div key={i} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[78%] rounded-xl px-2.5 py-1.5 text-[11px] leading-snug shadow-sm ${
                  msg.from === 'user' ? 'text-white rounded-tr-sm' : 'bg-white text-gray-800 rounded-tl-sm'
                }`}
                style={msg.from === 'user' ? { background: '#2AABEE' } : {}}
              >
                {msg.text}
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  )
}

function OnboardingAnimation() {
  const [phase, setPhase] = useState(0) // 0=idle 1=typed 2=activating 3=success
  useEffect(() => {
    const delays = [900, 950, 850, 2000]
    const t = setTimeout(() => setPhase((p) => (p >= 3 ? 0 : p + 1)), delays[phase])
    return () => clearTimeout(t)
  }, [phase])

  return (
    <div className="bg-white flex flex-col justify-center px-4 py-5" style={{ height: 160 }}>
      {phase === 3 ? (
        <div className="text-center">
          <div className="text-4xl mb-2">✅</div>
          <div className="font-semibold text-gray-900 text-sm">Bot attivato!</div>
          <div className="text-xs text-gray-400 mt-1">Pronto a rispondere agli inquilini</div>
        </div>
      ) : (
        <>
          <div className="text-[11px] font-medium text-gray-500 mb-1.5">Token Telegram</div>
          <div
            className={`rounded-lg border px-3 py-2 text-[11px] font-mono mb-3 transition-all duration-500 ${
              phase === 0
                ? 'border-gray-200 bg-gray-50 text-gray-300'
                : 'border-brand-400 bg-brand-50 text-gray-700'
            }`}
          >
            {phase === 0 ? 'Incolla il token qui…' : '7432156:AAHdqTcvCH1v…'}
          </div>
          <button
            className={`w-full rounded-lg py-2 text-xs font-semibold transition-all ${
              phase === 0 ? 'bg-gray-100 text-gray-400' : 'bg-brand-600 text-white'
            }`}
          >
            {phase === 2 ? (
              <span className="flex items-center justify-center gap-1.5">
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                Attivazione…
              </span>
            ) : (
              'Attiva bot →'
            )}
          </button>
        </>
      )}
    </div>
  )
}

const INQ_ROWS = [
  { nome: 'Marco Rossi',   app: 'App. 2A', icon: '🟢', label: 'Collegato' },
  { nome: 'Laura Bianchi', app: 'App. 3B', icon: '🟢', label: 'Collegato' },
  { nome: 'Ahmed Hassan',  app: 'App. 1C', icon: '⏳', label: 'In attesa' },
]
const CONT_ROWS = [
  { nome: 'Contratto_Rossi.pdf',   chunks: '24 chunk' },
  { nome: 'Contratto_Bianchi.pdf', chunks: '31 chunk' },
]

function DashboardAnimation() {
  // 0=empty, 1-3=inq rows appear, 4=pause, 5=switch tab, 6-7=cont rows appear, 8=pause→reset
  const [step, setStep] = useState(0)
  useEffect(() => {
    const delays = [350, 550, 550, 550, 1500, 300, 600, 600, 2000]
    const t = setTimeout(() => setStep((s) => (s >= 8 ? 0 : s + 1)), delays[step] ?? 600)
    return () => clearTimeout(t)
  }, [step])

  const activeTab = step >= 5 ? 'contratti' : 'inquilini'
  const inqVisible = activeTab === 'inquilini' ? Math.min(step, 3) : 0
  const contVisible = activeTab === 'contratti' ? Math.min(step - 5, 2) : 0

  return (
    <div className="bg-white flex flex-col" style={{ height: 200 }}>
      {/* Tabs */}
      <div className="flex border-b border-gray-100 px-3 pt-2.5 gap-4 shrink-0">
        {(['inquilini', 'contratti'] as const).map((tab) => (
          <span
            key={tab}
            className={`pb-2 text-[11px] font-medium transition-colors cursor-default select-none ${
              activeTab === tab ? 'border-b-2 border-brand-500 text-brand-600' : 'text-gray-400'
            }`}
          >
            {tab === 'inquilini' ? 'Inquilini' : 'Contratti'}
          </span>
        ))}
      </div>
      {/* Rows */}
      <div className="flex-1 overflow-hidden px-3 pt-1">
        {activeTab === 'inquilini'
          ? INQ_ROWS.slice(0, inqVisible).map((r, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                <div>
                  <div className="text-[11px] font-medium text-gray-800 leading-tight">{r.nome}</div>
                  <div className="text-[10px] text-gray-400">{r.app}</div>
                </div>
                <span className="text-[10px] text-gray-500">{r.icon} {r.label}</span>
              </div>
            ))
          : CONT_ROWS.slice(0, contVisible).map((r, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <span>📄</span>
                  <div>
                    <div className="text-[10px] font-medium text-gray-800 leading-tight">{r.nome}</div>
                    <div className="text-[10px] text-gray-400">{r.chunks}</div>
                  </div>
                </div>
                <span>✅</span>
              </div>
            ))}
      </div>
    </div>
  )
}

const PLANS = [
  {
    name: 'Starter',
    price: '49',
    desc: 'Per chi inizia',
    features: ['1 proprietà', 'Fino a 30 unità', 'Telegram', 'Contratti RAG', 'Ticket manutenzione', 'KB normativa'],
    cta: 'Inizia gratis',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '129',
    desc: 'Per property manager',
    features: ['Fino a 5 proprietà', 'Fino a 150 unità', 'Telegram + WhatsApp', 'Broadcast', 'Dashboard analytics', 'Supporto prioritario'],
    cta: 'Prova gratis 14 giorni',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    desc: 'Per grandi portafogli',
    features: ['Proprietà illimitate', 'Unità illimitate', 'Tutti i canali', 'SLA garantito', 'Onboarding dedicato', 'API access'],
    cta: 'Contattaci',
    highlight: false,
  },
]

const FAQ = [
  { q: 'Gli inquilini devono installare qualcosa?', a: 'No. Usano Telegram che hanno già sul telefono. Basta che aggiungano il bot ai contatti.' },
  { q: 'Come funziona la privacy dei contratti?', a: 'Ogni inquilino vede solo i chunk del proprio contratto. La ricerca vettoriale è filtrata per inquilino_id a livello di database — impossibile accedere ai dati altrui.' },
  { q: 'Posso personalizzare le risposte del bot?', a: 'Sì. Puoi configurare nome, messaggio di benvenuto e caricare la tua Knowledge Base normativa (regolamento condominiale, procedure interne, ecc.).' },
  { q: 'Cosa succede dopo il trial?', a: 'Puoi attivare un piano Starter (€49/mese) o Pro (€129/mese). Nessun addebito automatico durante il trial.' },
  { q: 'Supporta più lingue?', a: "Sì. Puoi impostare la lingua per ogni inquilino (italiano o inglese). Il bot risponde nella lingua dell'inquilino." },
]

// ─── Telegram Icon SVG ────────────────────────────────────────────────────────

function TelegramIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="12" fill="#2AABEE" />
      <path
        d="M5.2 11.6l13.1-5.1c.6-.2 1.1.1.9.9l-2.2 10.5c-.2.7-.6.9-1.1.6l-3-2.3-1.5 1.4c-.2.2-.3.3-.6.3l.2-3.1 5.2-4.7c.2-.2 0-.3-.3-.1L8 14.5l-3-.9c-.6-.2-.6-.6.2-.9z"
        fill="white"
      />
    </svg>
  )
}

// ─── Telegram Chat Demo ───────────────────────────────────────────────────────

type Msg = { from: 'user' | 'bot'; text: string; time: string }

const DEMO_MESSAGES: Msg[] = [
  { from: 'user', text: 'Ciao, quanto pago di affitto al mese?', time: '09:41' },
  {
    from: 'bot',
    text: '💶 Canone mensile: €1.250\n📅 Scadenza contratto: 31/12/2026\n📋 Preavviso disdetta: 6 mesi',
    time: '09:41',
  },
  { from: 'user', text: 'Posso subaffittare?', time: '09:42' },
  {
    from: 'bot',
    text: 'No — l\'Art. 8 del tuo contratto vieta la sublocazione senza consenso scritto del proprietario.',
    time: '09:42',
  },
  { from: 'user', text: 'URGENTE — il bagno allaga!', time: '09:43' },
  { from: 'bot', text: '🚨 Ticket urgente #42 creato. L\'amministrazione è stata avvisata immediatamente.', time: '09:43' },
]

function TelegramChatDemo() {
  return (
    <div className="mx-auto max-w-sm w-full rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: '#2AABEE' }}>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
          style={{ background: '#1a96d4' }}
        >
          TB
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white text-sm leading-tight">TenantBot</div>
          <div className="text-xs text-white/70">online</div>
        </div>
        <div className="flex items-center gap-3 text-white/80">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
          </svg>
        </div>
      </div>

      {/* Chat background */}
      <div
        className="px-3 py-4 space-y-2 overflow-y-auto"
        style={{ background: '#DAECF8', minHeight: 280, maxHeight: 340 }}
      >
        {DEMO_MESSAGES.map((msg, i) => (
          <div key={i} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[78%] rounded-2xl px-3 py-2 text-xs leading-relaxed relative shadow-sm ${
                msg.from === 'user'
                  ? 'text-white rounded-tr-sm'
                  : 'bg-white text-gray-800 rounded-tl-sm'
              }`}
              style={msg.from === 'user' ? { background: '#2AABEE' } : {}}
            >
              <div className="whitespace-pre-line">{msg.text}</div>
              <div
                className={`text-[10px] mt-1 text-right leading-none ${
                  msg.from === 'user' ? 'text-white/70' : 'text-gray-400'
                }`}
              >
                {msg.time}
                {msg.from === 'user' && (
                  <span className="ml-1 inline-flex">
                    {/* double tick */}
                    <svg viewBox="0 0 16 11" className="w-3 h-3 inline fill-white/80">
                      <path d="M11.071.653a.75.75 0 0 1 .025 1.06l-6.5 7a.75.75 0 0 1-1.085 0l-3-3a.75.75 0 1 1 1.085-1.038L4.02 7.11l5.975-6.432a.75.75 0 0 1 1.077-.025z" />
                      <path d="M14.071.653a.75.75 0 0 1 .025 1.06l-6.5 7a.75.75 0 0 1-1.056.025L5.5 7.5l1.06-1.06 1.497 1.497 5.974-6.409a.75.75 0 0 1 1.04.125z" />
                    </svg>
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-t border-gray-100">
        <div className="flex-1 rounded-full bg-gray-100 px-4 py-2 text-xs text-gray-400">
          Scrivi un messaggio…
        </div>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0"
          style={{ background: '#2AABEE' }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </div>
      </div>
    </div>
  )
}

// ─── Contact Form ─────────────────────────────────────────────────────────────

function ContactForm() {
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    // Placeholder: simulate sending (wire up to a backend/Formspree/Resend later)
    setTimeout(() => {
      setSending(false)
      setSent(true)
      formRef.current?.reset()
    }, 900)
  }

  if (sent) {
    return (
      <div className="rounded-2xl bg-green-50 border border-green-200 p-8 text-center">
        <div className="text-3xl mb-3">✅</div>
        <div className="font-semibold text-green-800 mb-1">Messaggio ricevuto!</div>
        <div className="text-sm text-green-600">Ti risponderemo entro 24 ore.</div>
        <button
          onClick={() => setSent(false)}
          className="mt-4 text-sm text-green-700 underline hover:no-underline"
        >
          Invia un altro messaggio
        </button>
      </div>
    )
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
          <input
            type="text"
            required
            placeholder="Mario Rossi"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            required
            placeholder="mario@example.com"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Messaggio</label>
        <textarea
          required
          rows={4}
          placeholder="Come possiamo aiutarti?"
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
        />
      </div>
      <button
        type="submit"
        disabled={sending}
        className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 transition-colors"
      >
        {sending ? 'Invio in corso…' : 'Invia messaggio'}
      </button>
    </form>
  )
}

// ─── Landing Page ─────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [user, setUser] = useState<{ email?: string } | null>(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
  }, [])

  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <a href="/" className="font-extrabold text-xl text-brand-700 tracking-tight">
            TenantBot
          </a>
          <div className="hidden md:flex items-center gap-7 text-sm text-gray-600 font-medium">
            <a href="#how" className="hover:text-gray-900 transition-colors">Come funziona</a>
            <a href="#features" className="hover:text-gray-900 transition-colors">Funzionalità</a>
            <a href="#pricing" className="hover:text-gray-900 transition-colors">Prezzi</a>
            <a href="#contact" className="hover:text-gray-900 transition-colors">Contatti</a>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold shrink-0 select-none">
                    {user.email?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <span className="text-sm text-gray-700 max-w-[160px] truncate hidden md:block">
                    {user.email}
                  </span>
                </div>
                <a
                  href={`${ADMIN_URL}/dashboard`}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors shadow-sm"
                >
                  Dashboard →
                </a>
              </div>
            ) : (
              <>
                <a
                  href={`${ADMIN_URL}/login`}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Accedi
                </a>
                <a
                  href={`${ADMIN_URL}/signup`}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors shadow-sm"
                >
                  Inizia gratis
                </a>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Subtle gradient background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% -10%, oklch(0.93 0.035 250) 0%, transparent 70%)',
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-16 lg:pt-28 lg:pb-20">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: text */}
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 mb-5 leading-[1.1]">
                Il bot AI che risponde{' '}
                <span className="text-brand-600">agli inquilini</span>{' '}
                al posto tuo
              </h1>
              <p className="text-lg text-gray-500 mb-8 leading-relaxed max-w-lg">
                Domande sul contratto, segnalazioni guasti, normativa condominiale — TenantBot
                risponde 24/7 su Telegram. Tu configuri una volta, lui lavora sempre.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                {user ? (
                  <a
                    href={`${ADMIN_URL}/dashboard`}
                    className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-7 py-3.5 text-base font-bold text-white hover:bg-brand-700 transition-colors shadow-md shadow-brand-200"
                  >
                    Vai alla dashboard →
                  </a>
                ) : (
                  <>
                    <a
                      href={`${ADMIN_URL}/signup`}
                      className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-7 py-3.5 text-base font-bold text-white hover:bg-brand-700 transition-colors shadow-md shadow-brand-200"
                    >
                      Inizia gratis — 14 giorni →
                    </a>
                    <a
                      href="#how"
                      className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-7 py-3.5 text-base font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Come funziona
                    </a>
                  </>
                )}
              </div>
              <p className="mt-3 text-sm text-gray-400">Nessuna carta di credito richiesta</p>
            </div>

            {/* Right: Telegram demo */}
            <div className="flex justify-center lg:justify-end">
              <TelegramChatDemo />
            </div>
          </div>
        </div>
      </section>

      {/* ── Come funziona ─────────────────────────────────────────────────── */}
      <section id="how" className="py-24 bg-brand-900">
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex items-center justify-center gap-3 mb-4">
            <TelegramIcon size={32} />
            <h2 className="text-3xl font-bold text-white">Come funziona</h2>
          </div>
          <p className="text-center text-brand-300 mb-14 text-base">
            Configurazione completa in meno di 10 minuti, direttamente su Telegram.
          </p>

          <div className="grid sm:grid-cols-3 gap-8">

            {/* Step 01 — BotFather */}
            <div className="flex flex-col">
              <div className="text-5xl font-extrabold text-brand-700 mb-3 leading-none">01</div>
              <div className="rounded-2xl overflow-hidden mb-5 shadow-xl">
                <BotFatherAnimation />
              </div>
              <h3 className="font-semibold text-white text-lg mb-2">Crea il bot su BotFather</h3>
              <p className="text-sm text-brand-300 leading-relaxed">
                Apri Telegram, scrivi /newbot a @BotFather e copia il token che ti dà. Ci vogliono 60 secondi.
              </p>
            </div>

            {/* Step 02 — Token paste */}
            <div className="flex flex-col">
              <div className="text-5xl font-extrabold text-brand-700 mb-3 leading-none">02</div>
              <div className="rounded-2xl overflow-hidden mb-5 shadow-xl">
                <OnboardingAnimation />
              </div>
              <h3 className="font-semibold text-white text-lg mb-2">Incolla il token in TenantBot</h3>
              <p className="text-sm text-brand-300 leading-relaxed">
                Incolla il token nella dashboard TenantBot e clicca Attiva. Il bot è subito online.
              </p>
            </div>

            {/* Step 03 — Dashboard */}
            <div className="flex flex-col">
              <div className="text-5xl font-extrabold text-brand-700 mb-3 leading-none">03</div>
              <div className="rounded-2xl overflow-hidden mb-5 shadow-xl">
                <DashboardAnimation />
              </div>
              <h3 className="font-semibold text-white text-lg mb-2">Aggiungi inquilini e contratti</h3>
              <p className="text-sm text-brand-300 leading-relaxed">
                Aggiungi gli inquilini e carica i PDF dei contratti dalla dashboard. Il bot è pronto a rispondere.
              </p>
            </div>

          </div>

          <div className="mt-12 text-center">
            <a
              href={`${ADMIN_URL}/signup`}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-bold text-brand-700 hover:bg-brand-50 transition-colors"
            >
              <TelegramIcon size={18} />
              Configura il bot Telegram ora
            </a>
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 bg-gray-50">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-3xl font-bold text-center mb-3 text-gray-900">
            Tutto quello che ti serve
          </h2>
          <p className="text-center text-gray-500 mb-12 max-w-xl mx-auto text-base">
            Dal contratto alla manutenzione, TenantBot copre ogni scenario di comunicazione.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl bg-white border border-gray-200 p-6 hover:border-brand-300 hover:shadow-md transition-all"
              >
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 bg-white">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-3xl font-bold text-center mb-3 text-gray-900">
            Prezzi semplici, nessuna sorpresa
          </h2>
          <p className="text-center text-gray-500 mb-12">
            Inizia gratis per 14 giorni. Nessuna carta richiesta.
          </p>
          <div className="grid sm:grid-cols-3 gap-6">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-6 flex flex-col transition-shadow ${
                  plan.highlight
                    ? 'border-brand-500 shadow-xl shadow-brand-100 bg-brand-50 relative'
                    : 'border-gray-200 bg-white hover:shadow-md'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-0.5 text-xs font-bold text-white whitespace-nowrap">
                    ⭐ Più popolare
                  </div>
                )}
                <div className="font-bold text-xl text-gray-900 mb-0.5">{plan.name}</div>
                <div className="text-sm text-gray-500 mb-5">{plan.desc}</div>
                <div className="mb-6">
                  {plan.price === 'Custom' ? (
                    <span className="text-3xl font-bold text-gray-900">Su misura</span>
                  ) : (
                    <>
                      <span className="text-4xl font-bold text-gray-900">€{plan.price}</span>
                      <span className="text-sm text-gray-500">/mese</span>
                    </>
                  )}
                </div>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="w-4 h-4 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                        ✓
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={plan.price === 'Custom' ? '#contact' : `${ADMIN_URL}/signup`}
                  className={`rounded-xl py-3 text-center text-sm font-bold transition-colors ${
                    plan.highlight
                      ? 'bg-brand-600 text-white hover:bg-brand-700'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-24 bg-gray-50">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">
            Domande frequenti
          </h2>
          <div className="space-y-3">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="group rounded-xl border border-gray-200 bg-white overflow-hidden"
              >
                <summary className="flex items-center justify-between gap-4 px-5 py-4 font-medium text-gray-900 cursor-pointer list-none hover:bg-gray-50 transition-colors">
                  {item.q}
                  <span className="text-gray-400 shrink-0 transition-transform group-open:rotate-180 text-lg leading-none">
                    ↓
                  </span>
                </summary>
                <div className="px-5 pb-4 text-sm text-gray-500 leading-relaxed border-t border-gray-100 pt-3">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact ───────────────────────────────────────────────────────── */}
      <section id="contact" className="py-24 bg-white">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-3xl font-bold text-center mb-3 text-gray-900">Contattaci</h2>
          <p className="text-center text-gray-500 mb-10">
            Hai domande o vuoi una demo personalizzata? Scrivici.
          </p>
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <ContactForm />
          </div>
        </div>
      </section>

      {/* ── CTA finale ────────────────────────────────────────────────────── */}
      <section className="py-24 bg-brand-700">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Pronto a automatizzare le comunicazioni?
          </h2>
          <p className="text-brand-200 mb-8 text-lg">
            Configura il bot in meno di 10 minuti. Nessuna carta richiesta.
          </p>
          <a
            href={`${ADMIN_URL}/signup`}
            className="inline-block rounded-xl bg-white px-10 py-4 text-base font-bold text-brand-700 hover:bg-brand-50 transition-colors shadow-sm"
          >
            Crea account gratuito →
          </a>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 bg-white py-8">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <a href="/" className="font-extrabold text-brand-700 text-base tracking-tight">
            TenantBot
          </a>
          <div className="flex gap-6">
            <a href="/privacy" className="hover:text-gray-700 transition-colors">Privacy</a>
            <a href="/termini" className="hover:text-gray-700 transition-colors">Termini</a>
            <a href="#contact" className="hover:text-gray-700 transition-colors">Contatti</a>
          </div>
          <div className="text-gray-400">© {new Date().getFullYear()} TenantBot. Tutti i diritti riservati.</div>
        </div>
      </footer>

    </div>
  )
}
