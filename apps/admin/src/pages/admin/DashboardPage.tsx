import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/PageHeader'
import { Badge } from '../../components/Badge'

interface Stats {
  ticketAperti: number
  convOggi: number
  unitaOccupate: number
  inquiliniAttivi: number
}

export function DashboardPage() {
  const { tenant } = useAuth()
  const [stats, setStats] = useState<Stats>({ ticketAperti: 0, convOggi: 0, unitaOccupate: 0, inquiliniAttivi: 0 })

  useEffect(() => {
    if (!tenant) return

    async function load() {
      const today = new Date().toISOString().slice(0, 10)

      const [tickets, conv, unita, inquilini] = await Promise.all([
        supabase.from('ticket_manutenzione').select('id', { count: 'exact', head: true }).in('stato', ['aperto', 'in_lavorazione']),
        supabase.from('conversazioni').select('id', { count: 'exact', head: true }).gte('created_at', today),
        supabase.from('unita').select('id', { count: 'exact', head: true }).eq('stato', 'occupata'),
        supabase.from('inquilini').select('id', { count: 'exact', head: true }).eq('attivo', true),
      ])

      setStats({
        ticketAperti: tickets.count ?? 0,
        convOggi: conv.count ?? 0,
        unitaOccupate: unita.count ?? 0,
        inquiliniAttivi: inquilini.count ?? 0,
      })
    }

    load()
  }, [tenant])

  const isTrialing = tenant?.subscription_status === 'trialing'
  const trialDaysLeft = tenant
    ? Math.max(0, Math.ceil((new Date(tenant.trial_ends_at).getTime() - Date.now()) / 86400000))
    : 0

  return (
    <div>
      <PageHeader title="Dashboard" description={`Ciao! Ecco il riepilogo di ${tenant?.nome ?? ''}`} />

      <div className="p-8 space-y-6">
        {/* Trial banner */}
        {isTrialing && (
          <div className="rounded-xl bg-brand-50 border border-brand-200 px-5 py-4 flex items-center justify-between">
            <div>
              <div className="font-medium text-brand-800">Trial gratuito attivo</div>
              <div className="text-sm text-brand-600 mt-0.5">
                {trialDaysLeft > 0 ? `Hai ancora ${trialDaysLeft} giorni.` : 'Il trial è scaduto.'} Attiva un piano per continuare.
              </div>
            </div>
            <a
              href="/billing"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
            >
              Attiva piano
            </a>
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard label="Ticket aperti" value={stats.ticketAperti} icon="🔧" color="danger" />
          <KpiCard label="Conversazioni oggi" value={stats.convOggi} icon="💬" color="info" />
          <KpiCard label="Unità occupate" value={stats.unitaOccupate} icon="🏠" color="success" />
          <KpiCard label="Inquilini attivi" value={stats.inquiliniAttivi} icon="👥" color="default" />
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Azioni rapide</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { href: '/inquilini', label: 'Aggiungi inquilino', icon: '👤' },
              { href: '/contratti', label: 'Nuovo contratto', icon: '📄' },
              { href: '/kb', label: 'Aggiungi KB', icon: '📚' },
              { href: '/ticket', label: 'Vedi ticket', icon: '🔧' },
            ].map((a) => (
              <a
                key={a.href}
                href={a.href}
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 hover:border-brand-300 hover:bg-brand-50 transition-colors"
              >
                <span className="text-xl">{a.icon}</span>
                <span className="text-sm font-medium text-gray-700">{a.label}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Piano attivo */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-1">Piano attivo</div>
              <div className="flex items-center gap-2">
                <Badge variant={tenant?.piano === 'pro' ? 'success' : tenant?.piano === 'enterprise' ? 'info' : 'default'}>
                  {tenant?.piano?.toUpperCase() ?? 'STARTER'}
                </Badge>
                <Badge variant={tenant?.subscription_status === 'active' ? 'success' : 'warning'}>
                  {tenant?.subscription_status ?? 'trialing'}
                </Badge>
              </div>
            </div>
            <a href="/billing" className="text-sm text-brand-600 hover:underline">Gestisci →</a>
          </div>
        </div>
      </div>
    </div>
  )
}

function KpiCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  const colorMap: Record<string, string> = {
    default: 'bg-gray-50 border-gray-200',
    success: 'bg-green-50 border-green-200',
    danger: 'bg-red-50 border-red-200',
    info: 'bg-blue-50 border-blue-200',
  }
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] ?? colorMap.default}`}>
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  )
}
