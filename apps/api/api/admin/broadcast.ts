import type { VercelRequest, VercelResponse } from '@vercel/node'
import { makeSupabase, loadBotConfig } from '../../_lib/supabase'
import { handleOptions, setCorsHeaders } from '../../_lib/cors'

export const config = { maxDuration: 60 }

async function tgSend(botToken: string, chatId: string, text: string): Promise<boolean> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    })
    if (!r.ok) {
      const body = await r.text()
      console.warn(`[broadcast] tg sendMessage ${r.status} chatId=${chatId}:`, body)
    }
    return r.ok
  } catch (e) {
    console.warn(`[broadcast] tg sendMessage exception chatId=${chatId}:`, e)
    return false
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return
  setCorsHeaders(res)
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { tenant_id, contenuto_it, contenuto_en, proprieta_id } = req.body as {
    tenant_id?: string
    contenuto_it?: string
    contenuto_en?: string
    proprieta_id?: string
  }

  if (!tenant_id) return res.status(400).json({ error: 'tenant_id richiesto' })
  if (!contenuto_it?.trim()) return res.status(400).json({ error: 'Messaggio italiano richiesto' })

  try {
    const supabase = makeSupabase()

    // 1. Check bot config
    const botConfig = await loadBotConfig(tenant_id, 'telegram')
    if (!botConfig) {
      return res.status(400).json({
        error: 'Bot Telegram non configurato. Attiva il bot dalla pagina Configurazione Bot.',
      })
    }

    // 2. Query inquilini with Telegram linked
    let query = supabase
      .from('inquilini')
      .select('id, telegram_user_id, lingua, unita_id')
      .eq('tenant_id', tenant_id)
      .eq('attivo', true)
      .not('telegram_user_id', 'is', null)

    // 3. Narrow to a specific property if requested
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
      return res.status(400).json({
        error: 'Nessun inquilino con Telegram collegato tra i destinatari selezionati',
      })
    }

    // 4. Send — use EN message for English tenants if provided, fallback to IT
    let sent_count = 0
    for (const inq of inquilini) {
      if (!inq.telegram_user_id) continue
      const text =
        inq.lingua === 'en' && contenuto_en?.trim()
          ? contenuto_en.trim()
          : contenuto_it.trim()
      const ok = await tgSend(botConfig.bot_token, inq.telegram_user_id, text)
      if (ok) sent_count++
    }

    // 5. Record in avvisi_broadcast
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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[broadcast]', msg)
    return res.status(500).json({ error: msg })
  }
}
