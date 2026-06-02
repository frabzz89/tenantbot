const ADMIN_URL = import.meta.env.VITE_ADMIN_URL as string ?? 'https://app.tenantbot.it'

const FEATURES = [
  { icon: '📄', title: 'Risposte dal contratto', desc: 'Il bot legge il PDF del contratto e risponde a qualsiasi domanda: canone, scadenza, clausole, cauzione. Privacy garantita: ogni inquilino vede solo il suo.' },
  { icon: '⚖️', title: 'Knowledge base normativa', desc: 'Carica regolamenti condominiali, legge 431/98, cedolare secca. Il bot risponde con la normativa corretta, dando sempre priorità al contratto individuale.' },
  { icon: '🔧', title: 'Ticket manutenzione', desc: 'Gli inquilini segnalano guasti direttamente via chat. Il bot classifica l\'urgenza (P1/P2), notifica l\'admin per le emergenze e tiene traccia dello stato.' },
  { icon: '📢', title: 'Broadcast a tutti', desc: 'Invia comunicazioni a tutti gli inquilini o a una proprietà specifica, sia su Telegram che su WhatsApp, in un clic dal backoffice.' },
  { icon: '📱', title: 'Telegram + WhatsApp', desc: 'Supporto nativo per entrambi i canali. Gli inquilini usano l\'app che preferiscono. Tu gestisci tutto da un\'unica dashboard.' },
  { icon: '🔒', title: 'Multi-tenant & sicuro', desc: 'Ogni property manager vede solo i propri dati. Row Level Security Supabase garantisce isolamento totale tra clienti.' },
]

const PLANS = [
  {
    name: 'Starter',
    price: '49',
    desc: 'Per chi inizia',
    features: ['1 proprietà', 'Fino a 30 unità', 'Solo Telegram', 'Contratti RAG', 'Ticket manutenzione', 'KB normativa'],
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
  { q: 'Gli inquilini devono installare qualcosa?', a: 'No. Usano Telegram o WhatsApp che hanno già sul telefono. Basta che aggiungano il bot ai contatti.' },
  { q: 'Come funziona la privacy dei contratti?', a: 'Ogni inquilino vede solo i chunk del proprio contratto. La ricerca vettoriale è filtrata per inquilino_id a livello di database — impossibile accedere ai dati altrui.' },
  { q: 'Posso personalizzare le risposte del bot?', a: 'Sì. Puoi configurare il nome del bot, il messaggio di benvenuto, e caricare la tua Knowledge Base normativa (regolamento condominiale, procedure interne, ecc.).' },
  { q: 'Cosa succede dopo il trial?', a: 'Puoi attivare un piano Starter (€49/mese) o Pro (€129/mese). Nessun addebito automatico durante il trial.' },
  { q: 'Supporta più lingue?', a: 'Sì. Puoi impostare la lingua per ogni inquilino (italiano o inglese). Il bot risponde nella lingua dell\'inquilino.' },
]

export default function App() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="font-bold text-xl text-brand-700">TenantBot</div>
          <div className="hidden sm:flex items-center gap-6 text-sm text-gray-600">
            <a href="#features" className="hover:text-gray-900">Funzionalità</a>
            <a href="#pricing" className="hover:text-gray-900">Prezzi</a>
            <a href="#faq" className="hover:text-gray-900">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <a href={`${ADMIN_URL}/login`} className="text-sm text-gray-600 hover:text-gray-900">Accedi</a>
            <a
              href={`${ADMIN_URL}/signup`}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
            >
              Inizia gratis
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 border border-brand-200 px-4 py-1.5 text-xs font-medium text-brand-700 mb-6">
          🤖 Powered by Claude AI + Voyage AI
        </div>
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-gray-900 mb-6 leading-tight">
          Il bot AI che risponde<br />
          <span className="text-brand-600">agli inquilini al posto tuo</span>
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          Domande sul contratto, segnalazioni guasti, normativa condominiale — TenantBot risponde 24/7 su Telegram e WhatsApp. Tu configuri una volta, lui lavora sempre.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href={`${ADMIN_URL}/signup`}
            className="rounded-xl bg-brand-600 px-8 py-4 text-base font-semibold text-white hover:bg-brand-700 transition-colors shadow-sm"
          >
            Inizia gratis — 14 giorni →
          </a>
          <a
            href="#features"
            className="rounded-xl border border-gray-300 px-8 py-4 text-base font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Come funziona
          </a>
        </div>
        <p className="mt-4 text-sm text-gray-400">Nessuna carta di credito richiesta</p>
      </section>

      {/* Demo chat mockup */}
      <section className="mx-auto max-w-4xl px-6 pb-20">
        <div className="rounded-3xl bg-gray-900 p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
            <div className="text-xs text-gray-500">TenantBot — Chat demo</div>
          </div>
          <div className="space-y-3 text-sm font-mono">
            <ChatMsg from="tenant" text="Ciao, quanto pago di affitto al mese?" />
            <ChatMsg from="bot" text="💶 Canone mensile: €1.250 (annuale: €15.000)&#10;📅 Scadenza contratto: 31/12/2026&#10;📋 Preavviso disdetta: 6 mesi" />
            <ChatMsg from="tenant" text="Posso subaffittare l'appartamento?" />
            <ChatMsg from="bot" text="No, il tuo contratto (Art. 8) vieta espressamente la sublocazione senza consenso scritto del proprietario. La legge 431/98 consente la sublocazione salvo diversa previsione contrattuale — ma nel tuo caso il contratto prevale." />
            <ChatMsg from="tenant" text="URGENTE — Il bagno al piano superiore allaga" />
            <ChatMsg from="bot" text="🚨 Richiesta urgente #42 registrata. L'amministrazione sarà avvisata immediatamente." />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-gray-50 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-3xl font-bold text-center mb-4">Tutto quello che ti serve</h2>
          <p className="text-center text-gray-500 mb-12 max-w-xl mx-auto">
            Dal contratto alla manutenzione, TenantBot copre ogni scenario di comunicazione con i tuoi inquilini.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl bg-white border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-3xl font-bold text-center mb-4">Prezzi semplici, nessuna sorpresa</h2>
          <p className="text-center text-gray-500 mb-12">Inizia gratis per 14 giorni. Nessuna carta richiesta.</p>
          <div className="grid sm:grid-cols-3 gap-6">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-6 flex flex-col ${
                  plan.highlight
                    ? 'border-brand-500 shadow-lg shadow-brand-100 bg-brand-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                {plan.highlight && (
                  <div className="text-xs font-semibold text-brand-700 uppercase tracking-wide mb-2">⭐ Più popolare</div>
                )}
                <div className="font-bold text-xl text-gray-900">{plan.name}</div>
                <div className="text-sm text-gray-500 mb-4">{plan.desc}</div>
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
                <ul className="space-y-2 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="text-green-500 shrink-0">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={plan.price === 'Custom' ? 'mailto:hello@tenantbot.it' : `${ADMIN_URL}/signup`}
                  className={`rounded-xl py-3 text-center text-sm font-semibold transition-colors ${
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

      {/* FAQ */}
      <section id="faq" className="bg-gray-50 py-24">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Domande frequenti</h2>
          <div className="space-y-4">
            {FAQ.map((item) => (
              <details key={item.q} className="rounded-xl border border-gray-200 bg-white p-5 group">
                <summary className="font-medium text-gray-900 cursor-pointer list-none flex items-center justify-between">
                  {item.q}
                  <span className="text-gray-400 group-open:rotate-180 transition-transform">↓</span>
                </summary>
                <p className="mt-3 text-sm text-gray-500 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA finale */}
      <section className="py-24 bg-brand-700">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Pronto a automatizzare le comunicazioni?</h2>
          <p className="text-brand-200 mb-8 text-lg">Inizia gratis oggi — configura il bot in meno di 10 minuti.</p>
          <a
            href={`${ADMIN_URL}/signup`}
            className="inline-block rounded-xl bg-white px-10 py-4 text-base font-bold text-brand-700 hover:bg-brand-50 transition-colors shadow-sm"
          >
            Crea account gratuito →
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <div className="font-bold text-brand-700">TenantBot</div>
          <div className="flex gap-6">
            <a href="/privacy" className="hover:text-gray-600">Privacy</a>
            <a href="/termini" className="hover:text-gray-600">Termini</a>
            <a href="mailto:hello@tenantbot.it" className="hover:text-gray-600">Contatti</a>
          </div>
          <div>© {new Date().getFullYear()} TenantBot. Tutti i diritti riservati.</div>
        </div>
      </footer>
    </div>
  )
}

function ChatMsg({ from, text }: { from: 'tenant' | 'bot'; text: string }) {
  return (
    <div className={`flex ${from === 'tenant' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-xs sm:max-w-sm rounded-2xl px-4 py-2.5 text-xs whitespace-pre-line ${
          from === 'tenant'
            ? 'bg-brand-600 text-white rounded-br-sm'
            : 'bg-gray-700 text-gray-100 rounded-bl-sm'
        }`}
      >
        {text}
      </div>
    </div>
  )
}
