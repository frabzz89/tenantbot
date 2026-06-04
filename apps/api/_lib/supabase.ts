import { createClient } from '@supabase/supabase-js'

export function makeSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY mancanti')
  return createClient(url, key)
}

export async function loadBotConfig(tenantId: string, canale: 'telegram' | 'whatsapp') {
  const supabase = makeSupabase()
  const { data, error } = await supabase
    .from('bot_configurazioni')
    .select('*, tenant:tenant_id(email_contatto)')
    .eq('tenant_id', tenantId)
    .eq('canale', canale)
    .eq('attivo', true)
    .single()

  if (error || !data) return null

  const raw = data as typeof data & { tenant?: { email_contatto: string } | null }

  return {
    tenant_id: raw.tenant_id as string,
    canale: raw.canale as 'telegram' | 'whatsapp',
    bot_token: raw.bot_token as string,
    webhook_secret: raw.webhook_secret as string | null,
    api_secret: raw.api_secret as string | null,
    admin_chat_id: raw.admin_chat_id as string | null,
    access_token: raw.access_token as string | null,
    lingua_default: raw.lingua_default as string,
    nome_bot: raw.nome_bot as string,
    messaggio_benvenuto: raw.messaggio_benvenuto as string | null,
    waba_id: raw.waba_id as string | null,
    // Property manager's email — used for P1 escalation notifications
    email_contatto: raw.tenant?.email_contatto ?? null as string | null,
  }
}
