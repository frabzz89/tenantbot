import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { supabase } from '../../lib/supabase'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (authErr) { setError(authErr.message); return }
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl font-bold text-brand-700 mb-1">TenantBot</div>
          <div className="text-sm text-gray-500">Accedi al tuo backoffice</div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="nome@azienda.it"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Accesso...' : 'Accedi'}
          </button>
          <div className="text-center">
            <Link to="/forgot-password" className="text-xs text-gray-400 hover:text-brand-600 transition-colors">
              Password dimenticata?
            </Link>
          </div>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Non hai un account?{' '}
          <Link to="/signup" className="text-brand-600 hover:underline font-medium">Registrati</Link>
        </p>
      </div>
    </div>
  )
}
