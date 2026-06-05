// Termini di Servizio — template da finalizzare con consulente legale

const ADMIN_URL = import.meta.env.VITE_ADMIN_URL as string ?? 'https://app.tenantbot.it'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h2 className="text-xl font-semibold text-gray-900 mb-3">{title}</h2>
      <div className="text-gray-600 leading-relaxed space-y-3">{children}</div>
    </div>
  )
}

export default function TerminiPage() {
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Termini di Servizio</h1>
        <p className="text-sm text-gray-400 mb-10">Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })} — <em>Bozza: da finalizzare prima del lancio commerciale</em></p>

        <Section title="1. Accettazione dei termini">
          <p>
            Utilizzando TenantBot ("il Servizio"), l'utente accetta integralmente i presenti Termini di Servizio. Se non accetti questi termini, non puoi utilizzare il Servizio.
          </p>
        </Section>

        <Section title="2. Descrizione del Servizio">
          <p>TenantBot è una piattaforma SaaS che consente ai property manager di:</p>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>Configurare bot Telegram per la comunicazione con gli inquilini</li>
            <li>Caricare e indicizzare contratti di locazione per risposta AI</li>
            <li>Gestire ticket di manutenzione e comunicazioni broadcast</li>
            <li>Accedere a una dashboard di backoffice multi-tenant</li>
          </ul>
        </Section>

        <Section title="3. Account e responsabilità">
          <p>L'utente è responsabile di:</p>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>Mantenere la riservatezza delle proprie credenziali di accesso</li>
            <li>Garantire il consenso degli inquilini al trattamento dei dati personali tramite il Servizio</li>
            <li>Fornire informazioni accurate e aggiornate</li>
            <li>Rispettare la normativa applicabile (GDPR, legge 431/98, ecc.)</li>
          </ul>
        </Section>

        <Section title="4. Piani e pagamenti">
          <p>TenantBot è disponibile in tre piani: Starter (€49/mese), Pro (€129/mese) ed Enterprise (prezzo personalizzato). I pagamenti sono gestiti tramite Stripe. L'abbonamento si rinnova automaticamente ogni mese fino alla cancellazione.</p>
          <p>Il trial gratuito di 14 giorni non richiede carta di credito. Al termine del trial, il Servizio viene sospeso se non viene attivato un piano a pagamento.</p>
        </Section>

        <Section title="5. Disdetta e rimborsi">
          <p>È possibile disdire l'abbonamento in qualsiasi momento dalla dashboard. La disdetta ha effetto al termine del periodo già pagato. Non sono previsti rimborsi per periodi parziali.</p>
        </Section>

        <Section title="6. Limitazioni del Servizio">
          <p>TenantBot è uno strumento di supporto alla comunicazione. Le risposte generate dall'AI sono indicative e non costituiscono consulenza legale. Il Titolare non è responsabile per:</p>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>Errori o imprecisioni nelle risposte generate dall'AI</li>
            <li>Decisioni prese dall'utente sulla base delle risposte del bot</li>
            <li>Interruzioni del Servizio dovute a terze parti (Telegram, Supabase, Vercel, ecc.)</li>
          </ul>
        </Section>

        <Section title="7. Proprietà intellettuale">
          <p>Il Servizio, il codice, il design e i contenuti originali di TenantBot sono di proprietà esclusiva del Titolare. I dati caricati dall'utente (contratti, documenti KB) rimangono di proprietà dell'utente.</p>
        </Section>

        <Section title="8. Modifica dei termini">
          <p>Il Titolare si riserva il diritto di modificare i presenti Termini con un preavviso di <strong>30 giorni</strong> via email. L'uso continuato del Servizio dopo la modifica costituisce accettazione dei nuovi termini.</p>
        </Section>

        <Section title="9. Legge applicabile">
          <p>I presenti Termini sono regolati dalla legge italiana. Per qualsiasi controversia è competente il Foro di <strong>[CITTÀ]</strong>.</p>
        </Section>

        <Section title="10. Contatti">
          <p>Per qualsiasi domanda relativa ai presenti Termini: <strong>[EMAIL LEGALE]</strong></p>
        </Section>

        <div className="mt-12 pt-8 border-t border-gray-100 text-sm text-gray-400">
          <p>⚠️ <em>Questo documento è una bozza. Prima del lancio commerciale va redatto/validato da un consulente legale o tramite un servizio come iubenda.com.</em></p>
        </div>
      </main>

      <footer className="border-t border-gray-100 py-6 mt-8">
        <div className="mx-auto max-w-4xl px-6 flex items-center justify-between text-sm text-gray-400">
          <a href="/" className="font-bold text-brand-700">TenantBot</a>
          <div className="flex gap-5">
            <a href="/privacy" className="hover:text-gray-700">Privacy</a>
            <a href="/termini" className="text-brand-600 font-medium">Termini</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
