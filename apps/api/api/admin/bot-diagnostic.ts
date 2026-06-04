import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleOptions, setCorsHeaders } from '../../_lib/cors'
import { makeSupabase } from '../../_lib/supabase'

/**
 * GET /api/admin/bot-diagnostic?tenant_id=xxx
 *
 * Returns:
 * - DB config for the tenant's telegram bot
 * - Live Telegram getWebhookInfo response
 * - Comparison showing whether they match
 *
 * Safe to call at any time — read-only.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return
  setCorsHeaders(res)
  if (req.method !== 'GET') return res.status(405).end()

  const tenantId = req.query.tenant_id as string
  if (!tenantId) return res.status(400).json({ error: 'tenant_id richiesto' })

  const supabase = makeSupabase()

  // 1. Load DB config
  const { data: cfg, error: dbErr } = await supabase
    .from('bot_configurazioni')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('canale', 'telegram')
    .single()

  if (dbErr || !cfg) {
    return res.status(404).json({ error: 'Configurazione bot non trovata per questo tenant' })
  }

  // 2. Ask Telegram for current webhook info
  let webhookInfo: unknown = null
  let telegramError: string | null = null
  try {
    const tgRes = await fetch(
      `https://api.telegram.org/bot${cfg.bot_token}/getWebhookInfo`
    )
    webhookInfo = await tgRes.json()
  } catch (e) {
    telegramError = e instanceof Error ? e.message : String(e)
  }

  // 3. Compute expected webhook URL
  const apiBase = `https://${req.headers.host}`
  const expectedWebhookUrl = `${apiBase}/api/webhook/telegram/${tenantId}`

  // 4. Extract registered URL from Telegram response
  const tgData = webhookInfo as { ok?: boolean; result?: { url?: string; last_error_message?: string; last_error_date?: number; pending_update_count?: number; has_custom_certificate?: boolean } } | null
  const registeredUrl = tgData?.result?.url ?? null
  const urlMatch = registeredUrl === expectedWebhookUrl

  return res.status(200).json({
    db: {
      attivo: cfg.attivo,
      nome_bot: cfg.nome_bot,
      admin_chat_id: cfg.admin_chat_id,
      lingua_default: cfg.lingua_default,
      // Never expose full token — show only last 6 chars
      bot_token_suffix: cfg.bot_token ? '...' + cfg.bot_token.slice(-6) : null,
      // Show first 6 chars of secret to help diagnose mismatches
      webhook_secret_prefix: cfg.webhook_secret ? cfg.webhook_secret.slice(0, 6) + '...' : null,
    },
    telegram: webhookInfo ?? { error: telegramError },
    diagnosis: {
      expectedWebhookUrl,
      registeredUrl,
      urlMatch,
      lastTelegramError: tgData?.result?.last_error_message ?? null,
      pendingUpdates: tgData?.result?.pending_update_count ?? null,
      recommendation: !urlMatch
        ? '⚠️  URL mismatch — vai su /bot e clicca "Attiva bot" per re-registrare il webhook.'
        : tgData?.result?.last_error_message
          ? `⚠️  Telegram riporta errore: "${tgData.result.last_error_message}" — controlla i Vercel logs.`
          : '✅  Webhook registrato correttamente. Se il bot non risponde, controlla i Vercel Function Logs.',
    },
  })
}
