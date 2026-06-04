import type { VercelRequest, VercelResponse } from '@vercel/node'
import { BotEngine, TelegramAdapter } from '@tenantbot/core'
import { loadBotConfig, makeSupabase } from '../../../_lib/supabase'

// Sends a plain text fallback directly to Telegram (bypasses the engine entirely)
async function sendFallback(botToken: string, chatId: string | number, text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: Number(chatId), text }),
    })
  } catch {
    // ignore — we're already in an error path
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  // ── Respond 200 IMMEDIATELY — before any async work ──────────────────────
  // Telegram marks the webhook as failed if it doesn't get a response within
  // a few seconds. Responding here guarantees Telegram never sees a 500,
  // regardless of what happens in the processing below.
  res.status(200).end()

  const tenantId = req.query.tenantId as string
  if (!tenantId) {
    console.warn('[telegram-webhook] missing tenantId in URL')
    return
  }

  let botToken: string | undefined
  let chatIdForFallback: string | undefined

  try {
    // ── Load bot configuration ───────────────────────────────────────────────
    const config = await loadBotConfig(tenantId, 'telegram')
    if (!config) {
      console.warn(`[telegram-webhook] config non trovata per tenant=${tenantId}`)
      return
    }
    botToken = config.bot_token

    // ── Webhook secret validation ────────────────────────────────────────────
    const secretHeader = req.headers['x-telegram-bot-api-secret-token']
    if (config.webhook_secret && secretHeader !== config.webhook_secret) {
      console.warn(
        `[telegram-webhook] secret mismatch tenant=${tenantId} ` +
        `got=${JSON.stringify(secretHeader)} ` +
        `expected_prefix=${config.webhook_secret.slice(0, 6)}...`
      )
      return
    }

    // ── Parse the incoming update ────────────────────────────────────────────
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
    const body = req.body

    const chatId = adapter.extractChatId(body)
    if (!chatId) {
      // Non-message update (callback_query, edited_message, etc.) — ignore silently
      return
    }
    chatIdForFallback = chatId

    const message = adapter.parseMessage(body)
    if (!message) {
      // Message with no text/contact (photo, sticker, etc.) — ignore silently
      return
    }

    // ── Run the bot engine ───────────────────────────────────────────────────
    const supabase = makeSupabase()
    const engine = new BotEngine({
      supabase,
      adapter,
      botConfig,
      voyageApiKey: process.env.VOYAGE_API_KEY ?? '',
      anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
      resendApiKey: process.env.RESEND_API_KEY ?? '',
      resendFromEmail: process.env.RESEND_FROM_EMAIL ?? 'TenantBot <noreply@tenantbot.it>',
      adminEmail: config.email_contatto ?? '',  // property manager's email from tenants table
    })

    await engine.handleMessage(message, chatId)

  } catch (err) {
    console.error(`[telegram-webhook] unhandled error tenant=${tenantId}:`, err)

    // Best-effort: tell the user something went wrong (if we have their chatId)
    if (botToken && chatIdForFallback) {
      await sendFallback(
        botToken,
        chatIdForFallback,
        'Si è verificato un errore interno. Riprova tra qualche minuto.'
      )
    }
  }
}
