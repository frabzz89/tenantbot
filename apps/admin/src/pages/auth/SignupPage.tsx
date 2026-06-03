import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { supabase } from '../../lib/supabase'
import { createTenant } from '../../lib/api'

export function SignupPage() {
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // 1. Crea utente Supabase Auth
      const { data: authData, error: authErr } = await supabase.auth.signUp({ email, password })
      if (authErr || !authData.user) {
        setError(authErr?.message ?? 'Errore registrazione')
        return
      }

      // 2. Crea tenant + collega utente come admin
      const result = await createTenant(authData.user.id, nome, email)
      if (!result.ok) {
        setError(result.error ?? 'Errore creazione account')
        return
      }

      navigate('/onboarding', { state: { tenant_id: result.tenant_id } })
    } catch (err) {
      setError('Errore di rete. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl font-bold text-brand-700 mb-1">TenantBot</div>
          <div className="text-sm text-gray-500">Inizia 14 giorni gratis, nessuna carta richiesta</div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome azienda / studio</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Studio Rossi Immobiliare"
            />
          </div>
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
              minLength={8}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Minimo 8 caratteri"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creazione account...' : 'Crea account gratuito'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Hai già un account?{' '}
          <Link to="/login" className="text-brand-600 hover:underline font-medium">Accedi</Link>
        </p>
      </div>
    </div>
  )
}
