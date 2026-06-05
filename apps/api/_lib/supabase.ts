import { createClient } from '@supabase/supabase-js'

export function makeSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY mancanti')
  return createClient(url, key)
}

export async function loadBotConfig(tenantId: string, canale: 'telegram' | 'whatsapp') {
  const supabase = makeSupabase()

  // Query 1: bot config — no join, maximally robust against FK/schema-cache issues
  const { data, error } = await supabase
    .from('bot_configurazioni')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('canale', canale)
    .eq('attivo', true)
    .single()

  if (error || !data) {
    console.warn(
      `[loadBotConfig] query failed tenant=${tenantId} canale=${canale}:`,
      error?.message ?? 'no data'
    )
    return null
  }

  // Query 2: email_contatto from tenants — separate, non-blocking on failure
  // (used for P1 escalation emails; bot works fine without it)
  let emailContatto: string | null = null
  try {
    const { data: tenantRow } = await supabase
      .from('tenants')
      .select('email_contatto')
      .eq('id', tenantId)
      .single()
    emailContatto = tenantRow?.email_contatto ?? null
  } catch {
    // Non-fatal — bot works without admin email
  }

  return {
    tenant_id: data.tenant_id as string,
    canale: data.canale as 'telegram' | 'whatsapp',
    bot_token: data.bot_token as string,
    webhook_secret: data.webhook_secret as string | null,
    api_secret: data.api_secret as string | null,
    admin_chat_id: data.admin_chat_id as string | null,
    access_token: data.access_token as string | null,
    lingua_default: data.lingua_default as string,
    nome_bot: data.nome_bot as string,
    messaggio_benvenuto: data.messaggio_benvenuto as string | null,
    waba_id: data.waba_id as string | null,
    // Property manager's email — used for P1 escalation notifications
    email_contatto: emailContatto,
  }
}
