import type { VercelRequest, VercelResponse } from '@vercel/node'
import { loadBotConfig } from '../_lib/supabase'

// GET /api/setup/whatsapp?tenant_id=xxx&secret=INGEST_SECRET
// Istruzioni: il webhook WhatsApp va configurato manualmente nella Meta Business dashboard.
// Questo endpoint restituisce l'URL da registrare e verifica la configurazione.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ingestSecret = process.env.INGEST_SECRET
  if (ingestSecret && req.query.secret !== ingestSecret) {
    return res.status(403).json({ error: 'Unauthorized' })
  }

  const tenantId = req.query.tenant_id as string
  if (!tenantId) return res.status(400).json({ error: 'tenant_id richiesto' })

  const config = await loadBotConfig(tenantId, 'whatsapp')
  if (!config) return res.status(404).json({ error: 'Bot WhatsApp non configurato per questo tenant' })

  const host = req.headers.host ?? 'api.tenantbot.it'
  const webhookUrl = `https://${host}/api/webhook/whatsapp/${tenantId}`

  return res.status(200).json({
    ok: true,
    istruzioni: [
      '1. Accedi a Meta Business Dashboard → WhatsApp → Configurazione → Webhook',
      `2. Imposta l'URL webhook: ${webhookUrl}`,
      `3. Imposta il Token di verifica: ${config.webhook_secret ?? '(non impostato — aggiungi webhook_secret in bot_configurazioni)'}`,
      '4. Iscriviti agli eventi: messages, message_deliveries, messaging_postbacks',
    ],
    webhookUrl,
    phoneNumberId: config.bot_token,
    wabaId: config.waba_id,
  })
}
