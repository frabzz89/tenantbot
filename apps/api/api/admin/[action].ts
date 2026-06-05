/**
 * Consolidated admin API handler.
 * All /api/admin/* routes are served by this single Vercel function,
 * keeping the deployment under the 12-function Hobby plan limit.
 * Route: /api/admin/:action
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'crypto'
import { makeSupabase, loadBotConfig } from '../../_lib/supabase'
import { handleOptions, setCorsHeaders } from '../../_lib/cors'

// maxDuration must cover the slowest action (broadcast can take ~60s for many tenants)
export const config = { maxDuration: 60 }

// ─── Telegram helpers ─────────────────────────────────────────────────────────

const BOT_COMMANDS = [
  { command: 'contratto',    description: 'Domande sul mio contratto' },
  { command: 'normativa',    description: 'Normativa e regolamento condominiale' },
  { command: 'manutenzione', description: 'Segnala un guasto o problema' },
  { command: 'aiuto',        description: 'Come usare questo servizio' },
]

async function tgPost(botToken: string, method: string, body: object) {
  const r = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return r.json() as Promise<{ ok: boolean; description?: string; result?: Record<string, unknown> }>
}

async function tgGet(botToken: string, method: string) {
  const r = await fetch(`https://api.telegram.org/bot${botToken}/${method}`)
  return r.json() as Promise<{ ok: boolean; description?: string; result?: Record<string, unknown> }>
}

// ─── Action handlers ──────────────────────────────────────────────────────────

async function handleActivateBot(req: VercelRequest, res: VercelResponse) {
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
  const supabase = makeSupabase()

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

  const apiBase = `https://${req.headers.host}`
  const webhookUrl = `${apiBase}/api/webhook/telegram/${tenant_id}`

  const tgWebhook = await tgPost(bot_token, 'setWebhook', {
    url: webhookUrl,
    secret_token: webhookSecret,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true,
  })
  if (!tgWebhook.ok) {
    return res.status(500).json({ error: 'Telegram setWebhook: ' + (tgWebhook.description ?? 'errore sconosciuto') })
  }

  const tgCmds = await tgPost(bot_token, 'setMyCommands', { commands: BOT_COMMANDS })
  if (!tgCmds.ok) console.warn('[activate-bot] setMyCommands failed:', tgCmds.description)

  await tgPost(bot_token, 'setMyDescription', {
    description: 'Assistente per inquilini. Chiedimi info sul tuo contratto, segnala guasti o chiedi informazioni sul condominio.',
  })

  const getMeRes = await tgGet(bot_token, 'getMe')
  const botUsername = getMeRes.ok ? (getMeRes.result?.username as string | undefined) : undefined
  if (botUsername) {
    await supabase
      .from('bot_configurazioni')
      .update({ bot_username: botUsername })
      .eq('tenant_id', tenant_id)
      .eq('canale', 'telegram')
  }

  return res.status(200).json({ ok: true, webhookUrl, botUsername })
}

async function handleBroadcast(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { tenant_id, contenuto_it, contenuto_en, proprieta_id } = req.body as {
    tenant_id?: string
    contenuto_it?: string
    contenuto_en?: string
    proprieta_id?: string
  }
  if (!tenant_id) return res.status(400).json({ error: 'tenant_id richiesto' })
  if (!contenuto_it?.trim()) return res.status(400).json({ error: 'Messaggio italiano richiesto' })

  const supabase = makeSupabase()

  const botConfig = await loadBotConfig(tenant_id, 'telegram')
  if (!botConfig) {
    return res.status(400).json({ error: 'Bot Telegram non configurato. Attiva il bot dalla pagina Configurazione Bot.' })
  }

  let query = supabase
    .from('inquilini')
    .select('id, telegram_user_id, lingua, unita_id')
    .eq('tenant_id', tenant_id)
    .eq('attivo', true)
    .not('telegram_user_id', 'is', null)

  if (proprieta_id) {
    const { data: unita } = await supabase
      .from('unita')
      .select('id')
      .eq('tenant_id', tenant_id)
      .eq('proprieta_id', proprieta_id)
    const unitaIds = (unita ?? []).map((u: { id: string }) => u.id)
    if (unitaIds.length === 0) {
      return res.status(400).json({ error: 'Nessuna unità trovata per questa proprietà' })
    }
    query = query.in('unita_id', unitaIds)
  }

  const { data: inquilini, error: inqErr } = await query
  if (inqErr) return res.status(500).json({ error: inqErr.message })
  if (!inquilini || inquilini.length === 0) {
    return res.status(400).json({ error: 'Nessun inquilino con Telegram collegato tra i destinatari selezionati' })
  }

  let sent_count = 0
  for (const inq of inquilini) {
    if (!inq.telegram_user_id) continue
    const text =
      inq.lingua === 'en' && contenuto_en?.trim() ? contenuto_en.trim() : contenuto_it.trim()
    try {
      const r = await fetch(`https://api.telegram.org/bot${botConfig.bot_token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: inq.telegram_user_id, text }),
      })
      if (r.ok) sent_count++
      else console.warn(`[broadcast] tg ${r.status} chatId=${inq.telegram_user_id}`)
    } catch (e) {
      console.warn(`[broadcast] exception chatId=${inq.telegram_user_id}:`, e)
    }
  }

  await supabase.from('avvisi_broadcast').insert({
    tenant_id,
    proprieta_id: proprieta_id ?? null,
    contenuto_it: contenuto_it.trim(),
    contenuto_en: contenuto_en?.trim() ?? null,
    canale: 'telegram',
    sent_at: new Date().toISOString(),
    sent_count,
  })

  return res.status(200).json({ ok: true, sent_count })
}

async function handleInvite(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { tenant_id, email, ruolo = 'membro' } = req.body as {
    tenant_id?: string
    email?: string
    ruolo?: string
  }
  if (!tenant_id || !email) {
    return res.status(400).json({ error: 'tenant_id ed email richiesti' })
  }

  const supabase = makeSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authAdmin = (supabase.auth as any).admin

  const { data: inviteData, error: inviteErr } = await authAdmin.inviteUserByEmail(email)

  let userId: string
  let isNew = true

  if (inviteErr) {
    const { data: listData, error: listErr } = await authAdmin.listUsers({ perPage: 1000 })
    if (listErr) return res.status(500).json({ error: 'Errore ricerca utente: ' + listErr.message })

    const existing = listData?.users?.find((u: { email: string; id: string }) => u.email === email)
    if (!existing) return res.status(500).json({ error: 'Errore invito: ' + inviteErr.message })
    userId = existing.id
    isNew = false
  } else {
    userId = inviteData!.user.id
  }

  const { data: already } = await supabase
    .from('tenant_users')
    .select('id')
    .eq('tenant_id', tenant_id)
    .eq('user_id', userId)
    .maybeSingle()

  if (already) return res.status(409).json({ error: 'Questo utente è già membro del tuo team.' })

  const { error: tuErr } = await supabase
    .from('tenant_users')
    .insert({ tenant_id, user_id: userId, ruolo })

  if (tuErr) return res.status(500).json({ error: 'Errore aggiunta al team: ' + tuErr.message })

  return res.status(200).json({ ok: true, user_id: userId, is_new: isNew })
}

async function handleTeam(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const tenant_id = req.query.tenant_id as string
  if (!tenant_id) return res.status(400).json({ error: 'tenant_id richiesto' })

  const supabase = makeSupabase()

  const { data: members, error } = await supabase
    .from('tenant_users')
    .select('user_id, ruolo, created_at')
    .eq('tenant_id', tenant_id)
    .order('created_at')

  if (error) return res.status(500).json({ error: error.message })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authAdmin = (supabase.auth as any).admin
  const enriched = await Promise.all(
    (members ?? []).map(async (m: { user_id: string; ruolo: string; created_at: string }) => {
      const { data } = await authAdmin.getUserById(m.user_id)
      return {
        user_id: m.user_id,
        email: data?.user?.email ?? '(email non disponibile)',
        ruolo: m.ruolo as 'admin' | 'membro',
        created_at: m.created_at,
      }
    })
  )

  return res.status(200).json({ ok: true, members: enriched })
}

async function handleTenant(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { user_id, nome, email } = req.body as {
    user_id?: string
    nome?: string
    email?: string
  }
  if (!user_id || !nome || !email) {
    return res.status(400).json({ error: 'user_id, nome ed email richiesti' })
  }

  const supabase = makeSupabase()

  const { data: tenant, error: tErr } = await supabase
    .from('tenants')
    .insert({ nome, email_contatto: email })
    .select('id')
    .single()

  if (tErr || !tenant) {
    return res.status(500).json({ error: 'Errore creazione tenant: ' + tErr?.message })
  }

  const { error: tuErr } = await supabase
    .from('tenant_users')
    .insert({ tenant_id: tenant.id, user_id, ruolo: 'admin' })

  if (tuErr) return res.status(500).json({ error: 'Errore collegamento utente: ' + tuErr.message })

  return res.status(200).json({ ok: true, tenant_id: tenant.id })
}

// ─── Router ───────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return
  setCorsHeaders(res)

  const action = req.query.action as string

  try {
    switch (action) {
      case 'activate-bot': return await handleActivateBot(req, res)
      case 'broadcast':    return await handleBroadcast(req, res)
      case 'invite':       return await handleInvite(req, res)
      case 'team':         return await handleTeam(req, res)
      case 'tenant':       return await handleTenant(req, res)
      default:             return res.status(404).json({ error: `Unknown action: ${action}` })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[admin/${action}]`, msg)
    return res.status(500).json({ error: msg })
  }
}
