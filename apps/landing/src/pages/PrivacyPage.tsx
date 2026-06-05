// Privacy Policy — template da finalizzare con iubenda o consulente legale

const ADMIN_URL = import.meta.env.VITE_ADMIN_URL as string ?? 'https://app.tenantbot.it'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h2 className="text-xl font-semibold text-gray-900 mb-3">{title}</h2>
      <div className="text-gray-600 leading-relaxed space-y-3">{children}</div>
    </div>
  )
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between">
          <a href="/" className="font-extrabold text-xl text-brand-700 tracking-tight">TenantBot</a>
          <a href={`${ADMIN_URL}/login`} className="text-sm text-gray-500 hover:text-gray-800">Accedi</a>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Informativa sulla Privacy</h1>
        <p className="text-sm text-gray-400 mb-10">Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })} — <em>Bozza: da finalizzare con iubenda o consulente legale</em></p>

        <Section title="1. Titolare del trattamento">
          <p>
            Il titolare del trattamento dei dati personali è <strong>[RAGIONE SOCIALE]</strong>, con sede in <strong>[INDIRIZZO]</strong>, email: <strong>[EMAIL]</strong>.
          </p>
        </Section>

        <Section title="2. Dati raccolti">
          <p>TenantBot raccoglie le seguenti categorie di dati personali:</p>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li><strong>Dati degli utenti backoffice (property manager):</strong> nome, indirizzo email, dati di fatturazione.</li>
            <li><strong>Dati degli inquilini:</strong> nome, cognome, numero di telefono, indirizzo email, identificativo Telegram.</li>
            <li><strong>Dati dei contratti:</strong> testo estratto dai PDF caricati, necessario per le funzioni di risposta AI.</li>
            <li><strong>Dati di utilizzo:</strong> messaggi inviati al bot (conservati per migliorare il servizio), log di sistema.</li>
          </ul>
        </Section>

        <Section title="3. Finalità del trattamento">
          <p>I dati vengono trattati per le seguenti finalità:</p>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>Erogazione del servizio TenantBot (risposte AI, gestione ticket, broadcast)</li>
            <li>Gestione dell'account e della fatturazione</li>
            <li>Miglioramento del servizio e sicurezza informatica</li>
            <li>Adempimento di obblighi legali</li>
          </ul>
        </Section>

        <Section title="4. Base giuridica">
          <p>Il trattamento si basa su: esecuzione del contratto (fornitura del servizio), consenso dell'interessato (ove richiesto), e legittimo interesse del titolare.</p>
        </Section>

        <Section title="5. Conservazione dei dati">
          <p>I dati vengono conservati per il tempo strettamente necessario all'erogazione del servizio e non oltre <strong>24 mesi</strong> dalla cessazione del rapporto contrattuale, salvo diversi obblighi di legge.</p>
        </Section>

        <Section title="6. Terze parti e sub-responsabili">
          <p>TenantBot si avvale dei seguenti fornitori come responsabili del trattamento:</p>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li><strong>Supabase Inc.</strong> — database e autenticazione (USA, Standard Contractual Clauses)</li>
            <li><strong>Vercel Inc.</strong> — hosting e infrastruttura (USA, Standard Contractual Clauses)</li>
            <li><strong>Anthropic PBC</strong> — elaborazione AI (USA, Standard Contractual Clauses)</li>
            <li><strong>Stripe Inc.</strong> — pagamenti (USA, Standard Contractual Clauses)</li>
            <li><strong>Telegram Messenger Inc.</strong> — canale di comunicazione bot</li>
          </ul>
        </Section>

        <Section title="7. Diritti degli interessati">
          <p>Hai il diritto di accedere, rettificare, cancellare i tuoi dati, opporti al trattamento, richiedere la portabilità dei dati e proporre reclamo all'Autorità Garante per la protezione dei dati personali (Garante Privacy italiano).</p>
          <p>Per esercitare i tuoi diritti: <strong>[EMAIL CONTATTO PRIVACY]</strong></p>
        </Section>

        <Section title="8. Cookie">
          <p>Questo sito utilizza solo cookie tecnici strettamente necessari al funzionamento. Non vengono utilizzati cookie di profilazione o di terze parti a scopo pubblicitario.</p>
        </Section>

        <div className="mt-12 pt-8 border-t border-gray-100 text-sm text-gray-400">
          <p>⚠️ <em>Questo documento è una bozza. Prima del lancio commerciale va redatto/validato da un consulente legale o tramite un servizio come iubenda.com per garantire la conformità al GDPR.</em></p>
        </div>
      </main>

      <footer className="border-t border-gray-100 py-6 mt-8">
        <div className="mx-auto max-w-4xl px-6 flex items-center justify-between text-sm text-gray-400">
          <a href="/" className="font-bold text-brand-700">TenantBot</a>
          <div className="flex gap-5">
            <a href="/privacy" className="text-brand-600 font-medium">Privacy</a>
            <a href="/termini" className="hover:text-gray-700">Termini</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
