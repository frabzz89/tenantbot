import { useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface TenantInfo {
  id: string
  nome: string
  piano: 'starter' | 'pro' | 'enterprise'
  subscription_status: string
  trial_ends_at: string
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [tenant, setTenant] = useState<TenantInfo | null>(null)
  const [ruolo, setRuolo] = useState<'admin' | 'membro' | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) {
      setTenant(null)
      setRuolo(null)
      setLoading(false)
      return
    }

    setLoading(true)
    supabase
      .from('tenant_users')
      .select('ruolo, tenant:tenant_id(id, nome, piano, subscription_status, trial_ends_at)')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          const t = data.tenant as TenantInfo
          setTenant(t)
          setRuolo(data.ruolo as 'admin' | 'membro')
        }
        setLoading(false)
      })
  }, [user])

  async function signOut() {
    await supabase.auth.signOut()
  }

  return { session, user, tenant, ruolo, loading, signOut }
}
