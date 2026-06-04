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

  const tenantId = req.query.tenantId as string
  if (!tenantId) return res.status(400).end()

  // ── Load bot configuration ─────────────────────────────────────────────────
  let config: Awaited<ReturnType<typeof loadBotConfig>>
  try {
    config = await loadBotConfig(tenantId, 'telegram')
  } catch (err) {
    console.error(`[telegram-webhook] loadBotConfig failed tenant=${tenantId}:`, err)
    return res.status(200).end()
  }

  if (!config) {
    console.warn(`[telegram-webhook] config non trovata per tenant=${tenantId}`)
    return res.status(200).end()
  }

  // ── Webhook secret validation ──────────────────────────────────────────────
  // Log the actual header so we can diagnose mismatches in Vercel logs.
  const secretHeader = req.headers['x-telegram-bot-api-secret-token']
  if (config.webhook_secret) {
    if (secretHeader !== config.webhook_secret) {
      console.warn(
        `[telegram-webhook] secret mismatch tenant=${tenantId} ` +
        `got=${JSON.stringify(secretHeader)} ` +
        `expected_prefix=${config.webhook_secret.slice(0, 6)}...`
      )
      return res.status(403).end()
    }
  }

  // ── Parse the incoming update ──────────────────────────────────────────────
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
  if (!chatId) return res.status(200).end()

  const message = adapter.parseMessage(body)
  if (!message) return res.status(200).end()

  // ── Run the engine — always respond 200 to Telegram ───────────────────────
  // Telegram retries on non-200, which can flood the function.
  // We respond 200 here and handle errors inside.
  res.status(200).end()

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
    console.error(`[telegram-webhook] engine error tenant=${tenantId} chat=${chatId}:`, err)

    // Send a fallback so the user knows something went wrong
    // (instead of just staring at silence)
    await sendFallback(
      config.bot_token,
      chatId,
      'Si è verificato un errore interno. Riprova tra qualche minuto.'
    )
  }
}
