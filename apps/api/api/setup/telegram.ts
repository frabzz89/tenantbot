import type { VercelRequest, VercelResponse } from '@vercel/node'
import { TelegramAdapter } from '@tenantbot/core'
import { loadBotConfig } from '../../_lib/supabase'
import { handleOptions, setCorsHeaders } from '../../_lib/cors'

// GET /api/setup/telegram?tenant_id=xxx&secret=INGEST_SECRET
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return
  setCorsHeaders(res)

  const ingestSecret = process.env.INGEST_SECRET
  if (ingestSecret && req.query.secret !== ingestSecret) {
    return res.status(403).json({ error: 'Unauthorized' })
  }

  const tenantId = req.query.tenant_id as string
  if (!tenantId) return res.status(400).json({ error: 'tenant_id richiesto' })

  const config = await loadBotConfig(tenantId, 'telegram')
  if (!config) return res.status(404).json({ error: 'Bot Telegram non configurato per questo tenant' })

  const botConfig = {
    tenantId,
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
  const host = req.headers.host ?? 'api.tenantbot.it'
  const webhookUrl = `https://${host}/api/webhook/telegram/${tenantId}`

  await adapter.setupWebhook(webhookUrl)
  const webhookInfo = await adapter.getWebhookInfo()

  return res.status(200).json({ ok: true, webhookUrl, webhookInfo })
}


