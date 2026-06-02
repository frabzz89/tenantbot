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
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('canale', canale)
    .eq('attivo', true)
    .single()

  if (error || !data) return null
  return data as {
    tenant_id: string
    canale: 'telegram' | 'whatsapp'
    bot_token: string
    webhook_secret: string | null
    api_secret: string | null
    admin_chat_id: string | null
    access_token: string | null
    lingua_default: string
    nome_bot: string
    messaggio_benvenuto: string | null
    waba_id: string | null
  }
}
