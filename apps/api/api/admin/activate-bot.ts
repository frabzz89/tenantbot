import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'crypto'
import { makeSupabase } from '../../_lib/supabase'
import { handleOptions, setCorsHeaders } from '../../_lib/cors'

// Bot commands shown in the Telegram menu (hamburger icon next to the input field)
const BOT_COMMANDS = [
  { command: 'contratto',   description: 'Domande sul mio contratto' },
  { command: 'normativa',   description: 'Normativa e regolamento condominiale' },
  { command: 'manutenzione',description: 'Segnala un guasto o problema' },
  { command: 'aiuto',       description: 'Come usare questo servizio' },
]

// POST /api/admin/activate-bot
// Saves Telegram bot config to DB, registers the webhook and sets up commands.
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

  async function tgPost(method: string, body: object) {
    const r = await fetch(`https://api.telegram.org/bot${bot_token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await r.json() as { ok: boolean; description?: string; result?: Record<string, unknown> }
    return json
  }

  async function tgGet(method: string) {
    const r = await fetch(`https://api.telegram.org/bot${bot_token}/${method}`)
    const json = await r.json() as { ok: boolean; description?: string; result?: Record<string, unknown> }
    return json
  }

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

    // 2. Register webhook
    const apiBase = `https://${req.headers.host}`
    const webhookUrl = `${apiBase}/api/webhook/telegram/${tenant_id}`

    const tgWebhook = await tgPost('setWebhook', {
      url: webhookUrl,
      secret_token: webhookSecret,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: true,  // clear any stale queued updates from previous errors
    })

    if (!tgWebhook.ok) {
      return res.status(500).json({ error: 'Telegram setWebhook: ' + (tgWebhook.description ?? 'errore sconosciuto') })
    }

    // 3. Set bot commands (creates the menu visible next to the input field)
    const tgCmds = await tgPost('setMyCommands', { commands: BOT_COMMANDS })
    if (!tgCmds.ok) {
      // Non-fatal: webhook works but menu might be empty
      console.warn('[activate-bot] setMyCommands failed:', tgCmds.description)
    }

    // 4. Set bot description shown on the profile page before first /start
    await tgPost('setMyDescription', {
      description: 'Assistente per inquilini. Chiedimi info sul tuo contratto, segnala guasti o chiedi informazioni sul condominio.',
    })

    // 5. Fetch bot username (needed for deep links: t.me/USERNAME?start=...)
    const getMeRes = await tgGet('getMe')
    const botUsername = getMeRes.ok ? (getMeRes.result?.username as string | undefined) : undefined
    if (botUsername) {
      await supabase
        .from('bot_configurazioni')
        .update({ bot_username: botUsername })
        .eq('tenant_id', tenant_id)
        .eq('canale', 'telegram')
    }

    return res.status(200).json({ ok: true, webhookUrl, botUsername })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[activate-bot]', msg)
    return res.status(500).json({ error: msg })
  }
}
