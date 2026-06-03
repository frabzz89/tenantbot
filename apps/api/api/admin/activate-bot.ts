import type { VercelRequest, VercelResponse } from '@vercel/node'
import { TelegramAdapter } from '@tenantbot/core'
import { makeSupabase } from '../../_lib/supabase'
import { handleOptions, setCorsHeaders } from '../../_lib/cors'

// POST /api/admin/activate-bot
// Saves bot config to DB and registers the Telegram webhook — all server-side.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return
  setCorsHeaders(res)
  if (req.method !== 'POST') return res.status(405).end()

  const { tenant_id, bot_token, nome_bot } = req.body as {
    tenant_id?: string
    bot_token?: string
    nome_bot?: string
  }

  if (!tenant_id || !bot_token) {
    return res.status(400).json({ error: 'tenant_id e bot_token richiesti' })
  }

  const webhookSecret = crypto.randomUUID().replace(/-/g, '')

  try {
    const supabase = makeSupabase()

    // 1. Save bot config (service role bypasses RLS)
    const { error: dbErr } = await supabase.from('bot_configurazioni').upsert({
      tenant_id,
      canale: 'telegram',
      bot_token,
      webhook_secret: webhookSecret,
      nome_bot: nome_bot ?? 'TenantBot',
      lingua_default: 'it',
      attivo: true,
    }, { onConflict: 'tenant_id,canale' })

    if (dbErr) return res.status(500).json({ error: 'Errore salvataggio: ' + dbErr.message })

    // 2. Register Telegram webhook (server-side fetch — no CORS issues)
    const botConfig = {
      tenantId: tenant_id,
      canale: 'telegram' as const,
      botToken: bot_token,
      webhookSecret,
      apiSecret: null,
      adminChatId: null,
      accessToken: null,
      linguaDefault: 'it',
      nomeBot: nome_bot ?? 'TenantBot',
      messaggioBenvenuto: null,
    }

    const adapter = new TelegramAdapter(botConfig)
    // Use the API host for the webhook URL (this IS the API server)
    const apiBase = `https://${req.headers.host}`
    const webhookUrl = `${apiBase}/api/webhook/telegram/${tenant_id}`

    await adapter.setupWebhook(webhookUrl)
    const webhookInfo = await adapter.getWebhookInfo()

    return res.status(200).json({ ok: true, webhookUrl, webhookInfo })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[activate-bot]', msg)
    return res.status(500).json({ error: msg })
  }
}
