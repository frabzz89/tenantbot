import type { VercelRequest, VercelResponse } from '@vercel/node'
import { BotEngine, WhatsAppAdapter } from '@tenantbot/core'
import { loadBotConfig, makeSupabase } from '../../_lib/supabase'

// WhatsApp richiede verifica webhook GET al momento del subscribe
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const tenantId = req.query.tenantId as string
  if (!tenantId) return res.status(400).json({ error: 'tenantId mancante' })

  // ─── GET: verifica webhook Meta ───────────────────────────────────────────
  if (req.method === 'GET') {
    const mode = req.query['hub.mode']
    const challenge = req.query['hub.challenge']
    const verifyToken = req.query['hub.verify_token']

    const config = await loadBotConfig(tenantId, 'whatsapp')
    if (!config) return res.status(404).end()

    if (mode === 'subscribe' && verifyToken === config.webhook_secret) {
      return res.status(200).send(challenge)
    }
    return res.status(403).end()
  }

  // ─── POST: messaggio in ingresso ──────────────────────────────────────────
  if (req.method !== 'POST') return res.status(405).end()

  const config = await loadBotConfig(tenantId, 'whatsapp')
  if (!config) {
    console.warn(`[wa-webhook] config non trovata per tenant=${tenantId}`)
    return res.status(200).end()
  }

  const botConfig = {
    tenantId: config.tenant_id,
    canale: 'whatsapp' as const,
    botToken: config.bot_token,        // = phone_number_id
    webhookSecret: config.webhook_secret,
    apiSecret: config.api_secret,
    adminChatId: config.admin_chat_id,
    accessToken: config.access_token,
    linguaDefault: config.lingua_default,
    nomeBot: config.nome_bot,
    messaggioBenvenuto: config.messaggio_benvenuto,
  }

  const adapter = new WhatsAppAdapter(botConfig)

  // Verifica firma HMAC-SHA256
  const rawBody = JSON.stringify(req.body)
  if (!adapter.validateWebhook(req.headers as Record<string, string | undefined>, rawBody)) {
    return res.status(403).end()
  }

  const message = adapter.parseMessage(req.body)
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

    // Il recipient per WhatsApp è il numero del mittente (senza il +)
    await engine.handleMessage(message, message.senderId)
  } catch (err) {
    console.error(`[wa-webhook] tenant=${tenantId} error:`, err)
  }

  return res.status(200).end()
}
