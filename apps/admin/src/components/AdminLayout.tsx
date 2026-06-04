import { NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../hooks/useAuth'

const NAV = [
  { to: '/dashboard', label: '🏠 Dashboard' },
  { to: '/properties', label: '🏢 Palazzine' },
  { to: '/unita', label: '🚪 Unità' },
  { to: '/inquilini', label: '👥 Inquilini' },
  { to: '/contratti', label: '📄 Contratti' },
  { to: '/kb', label: '📚 Knowledge Base' },
  { to: '/ticket', label: '🔧 Ticket' },
  { to: '/broadcast', label: '📢 Broadcast' },
  { to: '/bot', label: '🤖 Bot Config' },
  { to: '/billing', label: '💳 Piano & Fatturazione' },
  { to: '/settings', label: '⚙️ Impostazioni' },
]

export function AdminLayout() {
  const { tenant, user, signOut, loading } = useAuth()
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-brand-600 text-sm animate-pulse">Caricamento...</div>
      </div>
    )
  }

  if (!user) {
    navigate('/login')
    return null
  }

  if (!tenant) {
    navigate('/onboarding')
    return null
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 flex flex-col border-r border-gray-200 bg-white">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="font-bold text-brand-700 text-lg">TenantBot</div>
          <div className="text-xs text-gray-500 truncate">{tenant.nome}</div>
          <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-brand-100 text-brand-700">
            {tenant.piano}
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-gray-100 px-4 py-3">
          <div className="text-xs text-gray-500 truncate mb-1">{user.email}</div>
          <button
            onClick={async () => { await signOut(); navigate('/login') }}
            className="text-xs text-gray-400 hover:text-red-600 transition-colors"
          >
            Esci
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
