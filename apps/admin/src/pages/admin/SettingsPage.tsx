import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/PageHeader'

const API_URL = (import.meta.env.VITE_API_URL as string) ?? ''

type TeamMember = {
  user_id: string
  email: string
  ruolo: 'admin' | 'membro'
  created_at: string
}

export function SettingsPage() {
  const { tenant, user, ruolo } = useAuth()
  const isAdmin = ruolo === 'admin'

  // ── Company info ───────────────────────────────────────────────────────────
  const [nome, setNome] = useState('')
  const [emailContatto, setEmailContatto] = useState('')
  const [savingCompany, setSavingCompany] = useState(false)
  const [companyLoaded, setCompanyLoaded] = useState(false)

  useEffect(() => {
    if (!tenant) return
    supabase
      .from('tenants')
      .select('nome, email_contatto')
      .eq('id', tenant.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setNome(data.nome ?? '')
          setEmailContatto(data.email_contatto ?? '')
          setCompanyLoaded(true)
        }
      })
  }, [tenant])

  async function saveCompany() {
    if (!tenant) return
    setSavingCompany(true)
    const { error } = await supabase
      .from('tenants')
      .update({ nome, email_contatto: emailContatto })
      .eq('id', tenant.id)
    setSavingCompany(false)
    if (error) toast.error('Errore salvataggio: ' + error.message)
    else toast.success('Dati aggiornati')
  }

  // ── Team ───────────────────────────────────────────────────────────────────
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loadingTeam, setLoadingTeam] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRuolo, setInviteRuolo] = useState<'admin' | 'membro'>('membro')
  const [inviting, setInviting] = useState(false)

  async function loadTeam() {
    if (!tenant) return
    setLoadingTeam(true)
    try {
      const res = await fetch(`${API_URL}/api/admin/team?tenant_id=${tenant.id}`)
      const json = await res.json() as { ok?: boolean; members?: TeamMember[]; error?: string }
      if (json.ok) setMembers(json.members ?? [])
    } finally {
      setLoadingTeam(false)
    }
  }

  useEffect(() => { loadTeam() }, [tenant])

  async function inviteUser() {
    if (!tenant || !inviteEmail.trim()) return
    setInviting(true)
    try {
      const res = await fetch(`${API_URL}/api/admin/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenant.id, email: inviteEmail.trim(), ruolo: inviteRuolo }),
      })
      const json = await res.json() as { ok?: boolean; is_new?: boolean; error?: string }
      if (json.ok) {
        toast.success(
          json.is_new
            ? `Email di invito inviata a ${inviteEmail}`
            : `${inviteEmail} aggiunto al team`
        )
        setInviteEmail('')
        loadTeam()
      } else {
        toast.error(json.error ?? 'Errore durante l\'invito')
      }
    } catch {
      toast.error('Errore di rete')
    } finally {
      setInviting(false)
    }
  }

  async function removeMember(memberId: string, memberEmail: string) {
    if (!tenant) return
    if (!window.confirm(`Rimuovere ${memberEmail} dal team?`)) return
    const { error } = await supabase
      .from('tenant_users')
      .delete()
      .eq('tenant_id', tenant.id)
      .eq('user_id', memberId)
    if (error) toast.error('Errore rimozione: ' + error.message)
    else { toast.success('Collaboratore rimosso'); loadTeam() }
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Impostazioni"
        description="Profilo aziendale, team e sicurezza account"
      />

      <div className="p-8 space-y-6 max-w-2xl">

        {/* ── Company Info ── */}
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Profilo aziendale</h2>

          {!companyLoaded ? (
            <p className="text-sm text-gray-400 animate-pulse">Caricamento...</p>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Nome studio / azienda
                </label>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  disabled={!isAdmin}
                  className={INPUT}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Email di contatto
                </label>
                <input
                  type="email"
                  value={emailContatto}
                  onChange={(e) => setEmailContatto(e.target.value)}
                  disabled={!isAdmin}
                  className={INPUT}
                />
                <p className="mt-1 text-xs text-gray-400">
                  Usata per le notifiche di escalation sui ticket urgenti (P1)
                </p>
              </div>

              {isAdmin && (
                <div className="pt-1">
                  <button
                    onClick={saveCompany}
                    disabled={savingCompany || !nome || !emailContatto}
                    className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    {savingCompany ? 'Salvataggio...' : 'Salva modifiche'}
                  </button>
                </div>
              )}

              {!isAdmin && (
                <p className="text-xs text-gray-400 italic">Solo gli admin possono modificare il profilo aziendale.</p>
              )}
            </div>
          )}
        </section>

        {/* ── Team ── */}
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Team</h2>

          {/* Member list */}
          {loadingTeam ? (
            <p className="text-sm text-gray-400 animate-pulse">Caricamento team...</p>
          ) : (
            <div className="divide-y divide-gray-100 -mx-6 px-6">
              {members.map((m) => (
                <div key={m.user_id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {m.email}
                      {m.user_id === user?.id && (
                        <span className="ml-2 text-xs text-gray-400">(tu)</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {m.ruolo === 'admin' ? '👑 Admin' : '👤 Membro'}
                    </p>
                  </div>
                  {isAdmin && m.user_id !== user?.id && (
                    <button
                      onClick={() => removeMember(m.user_id, m.email)}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >
                      Rimuovi
                    </button>
                  )}
                </div>
              ))}
              {members.length === 0 && (
                <p className="py-4 text-sm text-gray-400">Nessun membro trovato</p>
              )}
            </div>
          )}

          {/* Invite form — admin only */}
          {isAdmin && (
            <div className="mt-5 pt-5 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Invita un collaboratore
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && inviteUser()}
                  placeholder="email@esempio.com"
                  className={INPUT + ' flex-1'}
                />
                <select
                  value={inviteRuolo}
                  onChange={(e) => setInviteRuolo(e.target.value as 'admin' | 'membro')}
                  className={INPUT + ' w-32 flex-none'}
                >
                  <option value="membro">Membro</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  onClick={inviteUser}
                  disabled={inviting || !inviteEmail.trim()}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {inviting ? '...' : 'Invita'}
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Se l'utente non ha ancora un account, riceverà un'email con il link per accedere.
                Gli utenti esistenti vengono aggiunti direttamente.
              </p>
            </div>
          )}
        </section>

        {/* ── Account ── */}
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Il tuo account</h2>
          <p className="text-sm text-gray-500 mb-3">
            Accesso con: <strong className="text-gray-800">{user?.email}</strong>
          </p>
          <a
            href="/forgot-password"
            className="text-sm text-brand-600 hover:underline"
          >
            Cambia password →
          </a>
        </section>

      </div>
    </div>
  )
}

const INPUT = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed'
