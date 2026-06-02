import type { VercelRequest, VercelResponse } from '@vercel/node'
import { BotEngine, TelegramAdapter } from '@tenantbot/core'
import { loadBotConfig, makeSupabase } from '../../../_lib/supabase'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const tenantId = req.query.tenantId as string
  if (!tenantId) return res.status(400).json({ error: 'tenantId mancante' })

  const config = await loadBotConfig(tenantId, 'telegram')
  if (!config) {
    console.warn(`[telegram-webhook] config non trovata per tenant=${tenantId}`)
    return res.status(200).end()
  }

  const botConfig = {
    tenantId: config.tenant_id,
    canale: 'telegram' as const,
    botToken: config.bot_token,
    webhookSecret: config.webhook_secret,
    apiSecret: null,
    adminChatId: config.admin_chat_id,
    accessToken: null,
    linguaDefault: config.lingua_default,
    nomeBot: config.nome_bot,
    messaggioBenvenuto: config.messaggio_benvenuto,
  }

  const adapter = new TelegramAdapter(botConfig)

  if (!adapter.validateWebhook(req.headers as Record<string, string | undefined>)) {
    return res.status(403).end()
  }

  const body = req.body
  const chatId = adapter.extractChatId(body)
  if (!chatId) return res.status(200).end()

  const message = adapter.parseMessage(body)
  if (!message) return res.status(200).end()

  try {
    const supabase = makeSupabase()
    const engine = new BotEngine({
      supabase,
      adapter,
      botConfig,
      voyageApiKey: process.env.VOYAGE_API_KEY ?? '',
      anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
      resendApiKey: process.env.RESEND_API_KEY ?? '',
      resendFromEmail: process.env.RESEND_FROM_EMAIL ?? 'TenantBot <noreply@tenantbot.it>',
      adminEmail: process.env.RESEND_ADMIN_EMAIL ?? '',
    })

    await engine.handleMessage(message, chatId)
  } catch (err) {
    console.error(`[telegram-webhook] tenant=${tenantId} error:`, err)
  }

  return res.status(200).end()
}

