import { useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../lib/supabase'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl font-bold text-brand-700 mb-1">TenantBot</div>
          <div className="text-sm text-gray-500">Recupero password</div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          {sent ? (
            <div className="text-center space-y-3">
              <div className="text-4xl">📧</div>
              <p className="text-sm font-medium text-gray-800">Email inviata!</p>
              <p className="text-sm text-gray-500">
                Controlla la casella <strong>{email}</strong> e clicca il link per impostare una nuova password.
              </p>
              <Link to="/login" className="block mt-4 text-sm text-brand-600 hover:underline">
                Torna al login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-gray-500">
                Inserisci la tua email e ti inviamo un link per reimpostare la password.
              </p>
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
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Invio...' : 'Invia link di recupero'}
              </button>
              <div className="text-center">
                <Link to="/login" className="text-xs text-gray-400 hover:text-brand-600 transition-colors">
                  Torna al login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
