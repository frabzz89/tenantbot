import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'crypto'
import { makeSupabase } from '../../_lib/supabase'
import { handleOptions, setCorsHeaders } from '../../_lib/cors'

// POST /api/admin/activate-bot
// Saves Telegram bot config to DB and registers the webhook directly via Telegram API.
// No @tenantbot/core import — avoids loading BotEngine and its heavy AI dependencies.
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

  const webhookSecret = randomUUID().replace(/-/g, '')

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

    // 2. Register webhook directly via Telegram Bot API (no adapter needed)
    const apiBase = `https://${req.headers.host}`
    const webhookUrl = `${apiBase}/api/webhook/telegram/${tenant_id}`

    const tgRes = await fetch(`https://api.telegram.org/bot${bot_token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: webhookSecret,
        allowed_updates: ['message', 'callback_query'],
      }),
    })

    const tgData = await tgRes.json() as { ok: boolean; description?: string }
    if (!tgData.ok) {
      return res.status(500).json({ error: 'Telegram: ' + (tgData.description ?? 'errore sconosciuto') })
    }

    return res.status(200).json({ ok: true, webhookUrl })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[activate-bot]', msg)
    return res.status(500).json({ error: msg })
  }
}
