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

// Step 01 — BotFather chat
const BF_MSGS = [
  { from: 'user', text: '/newbot' },
  { from: 'bot',  text: 'Come si chiama il bot?' },
  { from: 'user', text: 'Palazzi Milano Bot' },
  { from: 'bot',  text: 'Username? (deve finire in Bot)' },
  { from: 'user', text: 'palazzimilano_bot' },
  { from: 'bot',  text: '✅ Fatto! Ecco il tuo token:' },
] as const

function BotFatherAnimation() {
  const [visible, setVisible] = useState(0)
  // visible 0-6: messages; visible 7: token box shown; then reset
  useEffect(() => {
    const t = setTimeout(
      () => setVisible((v) => (v > BF_MSGS.length ? 0 : v + 1)),
      visible > BF_MSGS.length ? 3000 : 850,
    )
    return () => clearTimeout(t)
  }, [visible])

  const showToken = visible > BF_MSGS.length

  return (
    <div className="flex flex-col" style={{ height: 380 }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 shrink-0" style={{ background: '#2AABEE' }}>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
          style={{ background: '#1a96d4' }}
        >
          BF
        </div>
        <div>
          <div className="text-white text-sm font-semibold leading-none">@BotFather</div>
          <div className="text-white/70 text-[10px] leading-none mt-0.5">online</div>
        </div>
      </div>
      {/* Messages */}
      <div className="flex-1 px-3 py-3 space-y-2 overflow-hidden" style={{ background: '#DAECF8' }}>
        {BF_MSGS.slice(0, visible).map((msg, i) => (
          <div key={i} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-snug shadow-sm ${
                msg.from === 'user' ? 'text-white rounded-tr-sm' : 'bg-white text-gray-800 rounded-tl-sm'
              }`}
              style={msg.from === 'user' ? { background: '#2AABEE' } : {}}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {/* Token copy box */}
        {showToken && (
          <div className="bg-white rounded-2xl rounded-tl-sm shadow-sm px-3 py-3 max-w-[90%]">
            <div className="text-[10px] text-gray-500 mb-1.5">🔑 Token del tuo bot:</div>
            <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-300 rounded-xl px-3 py-2">
              <code className="flex-1 text-[11px] font-mono text-yellow-900 truncate">
                7432156:AAHdqTcvCH1vGbR...
              </code>
              <button className="flex items-center gap-1 text-[10px] bg-white border border-yellow-300 rounded-lg px-2 py-1 text-yellow-800 shrink-0 font-medium">
                📋 Copia
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Step 02 — Onboarding "Configura il bot" (faithful to real UI)
function OnboardingAnimation() {
  const [phase, setPhase] = useState(0) // 0=idle 1=typed 2=activating 3=success
  useEffect(() => {
    const delays = [1200, 1100, 900, 2200]
    const t = setTimeout(() => setPhase((p) => (p >= 3 ? 0 : p + 1)), delays[phase])
    return () => clearTimeout(t)
  }, [phase])

  return (
    <div className="bg-gray-50 p-5 flex flex-col" style={{ height: 460 }}>
      {phase === 3 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="text-5xl mb-4">✅</div>
          <div className="font-bold text-gray-900 text-lg mb-1">Bot attivato!</div>
          <div className="text-sm text-gray-500">Il tuo bot è online e pronto a rispondere agli inquilini.</div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm px-5 py-4 flex flex-col gap-3.5">
          {/* Title */}
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-lg">🤖</span>
              <h3 className="font-bold text-gray-900">Configura il bot</h3>
            </div>
            <p className="text-xs text-gray-500">Hai bisogno del telefono con Telegram — ci vogliono circa 2 minuti.</p>
          </div>

          {/* Channel tabs */}
          <div className="flex gap-2">
            <div className="flex-1 flex items-center justify-center gap-1.5 border-2 border-brand-500 bg-brand-50 text-brand-700 rounded-xl py-2 text-sm font-medium">
              <TelegramIcon size={15} />
              Telegram
            </div>
            <div className="flex-1 relative">
              <div className="w-full flex items-center justify-center gap-1.5 border border-gray-200 text-gray-400 rounded-xl py-2 text-sm font-medium opacity-70">
                {/* WhatsApp official icon */}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" fill="#25D366"/>
                </svg>
                WhatsApp
              </div>
              <span className="absolute -top-2 right-2 text-[9px] bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 font-semibold">Presto</span>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-brand-50 border border-brand-200 rounded-xl p-3">
            <div className="text-[11px] font-semibold text-brand-700 mb-2">Come creare il bot (una volta sola):</div>
            <ol className="space-y-1 text-[11px] text-brand-700">
              <li>1. Apri Telegram sul telefono</li>
              <li>2. Cerca <strong>@BotFather</strong> e aprilo</li>
              <li>3. Invia il comando: <code className="bg-brand-100 px-1 rounded text-[10px]">/newbot</code></li>
              <li>4. Scegli un nome (es. <em>"Palazzo Rossi Assistente"</em>) e uno username che finisce in "bot"</li>
              <li>5. BotFather ti darà un token — copialo e incollalo qui sotto</li>
            </ol>
            <button className="mt-2.5 flex items-center gap-1.5 border border-brand-300 rounded-lg px-2.5 py-1.5 text-[11px] text-brand-600 font-medium bg-white">
              <span className="text-xs">↗</span>
              Apri @BotFather in Telegram
            </button>
          </div>

          {/* Token input */}
          <div>
            <div className="text-xs font-medium text-gray-700 mb-1.5">Token del bot *</div>
            <div
              className={`border rounded-xl px-3 py-2.5 text-xs font-mono transition-all duration-500 ${
                phase === 0
                  ? 'border-gray-200 text-gray-400'
                  : 'border-brand-400 text-gray-800'
              }`}
            >
              {phase === 0 ? '1234567890:ABCdefGhIjKlmn...' : '7432156:AAHdqTcvCH1vGbR...'}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-medium">
              Indietro
            </button>
            <button
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all ${
                phase === 0 ? 'bg-gray-200 text-gray-400' : 'bg-brand-600 text-white'
              }`}
            >
              {phase === 2 ? (
                <span className="flex items-center justify-center gap-1.5">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                  Attivazione…
                </span>
              ) : (
                'Attiva bot →'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Step 03 — Dashboard with sidebar (faithful to real UI)
const DASH_INQ_ROWS = [
  { nome: 'Marco Rossi',   tel: '+393401234567', unita: 'Int. 3A — Palazzina 1', tg: true },
  { nome: 'Laura Bianchi', tel: '+393409876543', unita: 'App. 2B — Palazzina 1', tg: true },
  { nome: 'Ahmed Hassan',  tel: '+393412345678', unita: 'App. 3A — Palazzina 1', tg: false },
]
const DASH_CONT_ROWS = [
  { inq: 'Marco Rossi',   unita: 'Palazzina 1 / Int. 3A', canone: '€1.500/mese', scadenza: '01/01/2029', chunks: '7 chunk' },
  { inq: 'Laura Bianchi', unita: 'Palazzina 1 / App. 2B', canone: '€1.200/mese', scadenza: '30/06/2026', chunks: '12 chunk' },
]
const DASH_NAV = [
  { icon: '🏠', label: 'Dashboard' },
  { icon: '📋', label: 'Palazzine' },
  { icon: '🏢', label: 'Unità' },
  { icon: '👥', label: 'Inquilini' },
  { icon: '📄', label: 'Contratti' },
  { icon: '📚', label: 'Knowledge Base' },
  { icon: '🔧', label: 'Ticket' },
  { icon: '📢', label: 'Broadcast' },
  { icon: '🤖', label: 'Bot Config' },
]

function DashboardAnimation() {
  // 0=empty, 1-3=inq rows, 4=pause, 5=switch nav, 6-7=cont rows, 8=pause→reset
  const [step, setStep] = useState(0)
  useEffect(() => {
    const delays = [350, 600, 600, 600, 1500, 300, 700, 700, 2000]
    const t = setTimeout(() => setStep((s) => (s >= 8 ? 0 : s + 1)), delays[step] ?? 600)
    return () => clearTimeout(t)
  }, [step])

  const activeNav = step >= 5 ? 'Contratti' : 'Inquilini'
  const inqVisible = activeNav === 'Inquilini' ? Math.min(step, 3) : 0
  const contVisible = activeNav === 'Contratti' ? Math.min(step - 5, 2) : 0

  return (
    <div className="flex" style={{ height: 420 }}>
      {/* Sidebar */}
      <div className="w-44 bg-white border-r border-gray-100 flex flex-col px-3 pt-4 pb-3 shrink-0 overflow-hidden">
        <div className="font-extrabold text-brand-700 text-sm leading-none mb-0.5">TenantBot</div>
        <div className="text-[10px] text-gray-500 mb-2 truncate">Amministrazione Sartorelli</div>
        <span className="text-[9px] bg-brand-100 text-brand-700 rounded px-1.5 py-0.5 font-bold mb-4 self-start">
          STARTER
        </span>
        <div className="space-y-0.5 flex-1">
          {DASH_NAV.map(({ icon, label }) => (
            <div
              key={label}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] transition-colors ${
                label === activeNav
                  ? 'bg-brand-50 text-brand-700 font-semibold'
                  : 'text-gray-500'
              }`}
            >
              <span className="text-sm leading-none shrink-0">{icon}</span>
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 bg-gray-50 flex flex-col overflow-hidden">
        {activeNav === 'Inquilini' ? (
          <>
            {/* Header */}
            <div className="flex items-start justify-between px-4 pt-4 pb-3 bg-white border-b border-gray-100 shrink-0">
              <div>
                <div className="font-bold text-gray-900 text-base leading-tight">Inquilini</div>
                <div className="text-[11px] text-gray-500 mt-0.5">Gestisci gli inquilini e il loro collegamento al bot</div>
              </div>
              <div className="bg-brand-600 text-white text-[10px] font-semibold rounded-lg px-2.5 py-1.5 shrink-0 whitespace-nowrap ml-2">
                + Nuovo inquilino
              </div>
            </div>
            {/* Table */}
            <div className="flex-1 overflow-hidden px-3 pt-2.5">
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="grid px-3 py-2 border-b border-gray-100 text-[9px] font-semibold text-gray-400 uppercase tracking-wide"
                     style={{ gridTemplateColumns: '1.5fr 1.2fr 1.5fr 0.8fr 0.6fr' }}>
                  <span>Nominativo</span>
                  <span>Telefono</span>
                  <span>Unità</span>
                  <span>Telegram</span>
                  <span>Stato</span>
                </div>
                {DASH_INQ_ROWS.slice(0, inqVisible).map((r, i) => (
                  <div key={i} className="grid px-3 py-2.5 border-b border-gray-50 items-center"
                       style={{ gridTemplateColumns: '1.5fr 1.2fr 1.5fr 0.8fr 0.6fr' }}>
                    <span className="text-xs font-semibold text-gray-900 truncate pr-1">{r.nome}</span>
                    <span className="text-[10px] text-gray-500 truncate">{r.tel}</span>
                    <span className="text-[10px] text-gray-500 truncate pr-1">{r.unita}</span>
                    <span>
                      {r.tg
                        ? <span className="text-[9px] bg-green-100 text-green-700 rounded-full px-1.5 py-0.5 font-medium whitespace-nowrap">Collegato</span>
                        : <span className="text-[9px] bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 whitespace-nowrap">Non coll.</span>}
                    </span>
                    <span className="text-[9px] bg-green-100 text-green-700 rounded-full px-1.5 py-0.5 font-medium whitespace-nowrap">Attivo</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between px-4 pt-4 pb-3 bg-white border-b border-gray-100 shrink-0">
              <div>
                <div className="font-bold text-gray-900 text-base leading-tight">Contratti</div>
                <div className="text-[11px] text-gray-500 mt-0.5">Gestisci i contratti di locazione e gli embeddings RAG</div>
              </div>
              <div className="bg-brand-600 text-white text-[10px] font-semibold rounded-lg px-2.5 py-1.5 shrink-0 whitespace-nowrap ml-2">
                + Nuovo contratto
              </div>
            </div>
            {/* Table */}
            <div className="flex-1 overflow-hidden px-3 pt-2.5">
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="grid px-3 py-2 border-b border-gray-100 text-[9px] font-semibold text-gray-400 uppercase tracking-wide"
                     style={{ gridTemplateColumns: '1.2fr 1.4fr 1fr 0.9fr 0.7fr 0.6fr' }}>
                  <span>Inquilino</span>
                  <span>Unità</span>
                  <span>Canone</span>
                  <span>Scadenza</span>
                  <span>PDF/Emb.</span>
                  <span>Stato</span>
                </div>
                {DASH_CONT_ROWS.slice(0, contVisible).map((r, i) => (
                  <div key={i} className="grid px-3 py-2.5 border-b border-gray-50 items-center"
                       style={{ gridTemplateColumns: '1.2fr 1.4fr 1fr 0.9fr 0.7fr 0.6fr' }}>
                    <span className="text-xs font-semibold text-gray-900 truncate pr-1">{r.inq}</span>
                    <span className="text-[10px] text-gray-500 truncate pr-1">{r.unita}</span>
                    <span className="text-[10px] text-gray-700 font-medium">{r.canone}</span>
                    <span className="text-[10px] text-gray-500">{r.scadenza}</span>
                    <span className="text-[9px] bg-brand-100 text-brand-700 rounded-full px-1.5 py-0.5 font-medium whitespace-nowrap">{r.chunks}</span>
                    <span className="text-[9px] bg-green-100 text-green-700 rounded-full px-1.5 py-0.5 font-medium whitespace-nowrap">Attivo</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── How It Works Section (clickable steps) ──────────────────────────────────

const STEP_META = [
  {
    n: 1,
    label: 'Crea il bot su BotFather',
    desc: 'Apri Telegram, scrivi /newbot a @BotFather e copia il token che ti dà. Ci vogliono 60 secondi.',
  },
  {
    n: 2,
    label: 'Incolla il token in TenantBot',
    desc: 'Incolla il token nella dashboard TenantBot e clicca Attiva. Il bot è subito online.',
  },
  {
    n: 3,
    label: 'Aggiungi inquilini e contratti',
    desc: 'Aggiungi gli inquilini e carica i PDF dei contratti dalla dashboard. Il bot è pronto a rispondere.',
  },
]

function HowItWorks() {
  const [activeStep, setActiveStep] = useState(1)
  const step = STEP_META.find((s) => s.n === activeStep)!

  return (
    <section id="how" className="py-24 bg-brand-900">
      <div className="mx-auto max-w-5xl px-6">
        {/* Heading */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <TelegramIcon size={32} />
          <h2 className="text-3xl font-bold text-white">Come funziona</h2>
        </div>
        <p className="text-center text-brand-300 mb-10 text-base">
          Configurazione completa in meno di 10 minuti, direttamente su Telegram.
        </p>

        {/* Step selector */}
        <div className="grid grid-cols-3 gap-3 mb-8 max-w-2xl mx-auto">
          {STEP_META.map((s) => (
            <button
              key={s.n}
              onClick={() => setActiveStep(s.n)}
              className={`text-left rounded-2xl px-4 py-4 transition-all ${
                activeStep === s.n
                  ? 'bg-white shadow-xl ring-2 ring-white/20'
                  : 'bg-brand-800 hover:bg-brand-700'
              }`}
            >
              <div
                className={`text-4xl font-extrabold leading-none mb-2 ${
                  activeStep === s.n ? 'text-brand-600' : 'text-brand-600/40'
                }`}
              >
                {String(s.n).padStart(2, '0')}
              </div>
              <div
                className={`text-xs font-medium leading-snug ${
                  activeStep === s.n ? 'text-gray-900' : 'text-brand-300'
                }`}
              >
                {s.label}
              </div>
            </button>
          ))}
        </div>

        {/* Active animation frame */}
        <div className="rounded-2xl overflow-hidden shadow-2xl max-w-2xl mx-auto">
          {activeStep === 1 && <BotFatherAnimation />}
          {activeStep === 2 && <OnboardingAnimation />}
          {activeStep === 3 && <DashboardAnimation />}
        </div>

        {/* Step description */}
        <p className="text-center text-brand-300 mt-6 max-w-xl mx-auto text-sm leading-relaxed">
          {step.desc}
        </p>

        <div className="mt-10 text-center">
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
      <HowItWorks />

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
