import { createHmac } from 'crypto'
import type { BotConfig, ChannelAdapter, KeyboardButton, NormalizedMessage } from './types'

// Meta WhatsApp Business Cloud API v20
const GRAPH_URL = 'https://graph.facebook.com/v20.0'

type WaTextMessage = { type: 'text'; text: { body: string } }
type WaButtonReplyMessage = { type: 'interactive'; interactive: { type: 'button_reply'; button_reply: { id: string; title: string } } }
type WaContactsMessage = { type: 'contacts'; contacts: { phones?: { phone: string }[]; name: { formatted_name: string } }[] }
type WaMessage = (WaTextMessage | WaButtonReplyMessage | WaContactsMessage) & { from: string; id: string }

type WaWebhookBody = {
  object: string
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: WaMessage[]
        contacts?: { profile: { name: string }; wa_id: string }[]
      }
    }>
  }>
}

export class WhatsAppAdapter implements ChannelAdapter {
  readonly canale = 'whatsapp' as const

  constructor(private config: BotConfig) {}

  validateWebhook(headers: Record<string, string | string[] | undefined>, rawBody: string): boolean {
    if (!this.config.apiSecret) return true
    const sig = headers['x-hub-signature-256']
    if (!sig || typeof sig !== 'string') return false
    const expected = 'sha256=' + createHmac('sha256', this.config.apiSecret).update(rawBody).digest('hex')
    return sig === expected
  }

  parseMessage(body: unknown): NormalizedMessage | null {
    const wb = body as WaWebhookBody
    if (wb.object !== 'whatsapp_business_account') return null

    const changes = wb.entry?.[0]?.changes ?? []
    for (const change of changes) {
      const messages = change.value?.messages ?? []
      for (const msg of messages) {
        const senderId = msg.from  // E.164 senza +

        if (msg.type === 'text') {
          const text = msg.text.body
          return this.parseTextAsMessage(senderId, text)
        }

        if (msg.type === 'interactive' && msg.interactive.type === 'button_reply') {
          const text = msg.interactive.button_reply.title
          return this.parseTextAsMessage(senderId, text)
        }

        if (msg.type === 'contacts' && msg.contacts?.[0]) {
          const c = msg.contacts[0]
          const phone = c.phones?.[0]?.phone ?? senderId
          return {
            senderId,
            isCommand: false,
            contact: { phone, firstName: c.name.formatted_name },
          }
        }
      }
    }
    return null
  }

  private parseTextAsMessage(senderId: string, text: string): NormalizedMessage {
    if (text.startsWith('/')) {
      const parts = text.slice(1).split(' ')
      const cmd = parts[0].toLowerCase()
      return {
        senderId,
        text,
        isCommand: true,
        command: cmd,
        commandArgs: parts.slice(1).join(' ').trim() || undefined,
      }
    }
    return { senderId, text, isCommand: false }
  }

  async sendText(recipient: string, text: string): Promise<void> {
    await this.sendMessage(recipient, { type: 'text', text: { body: text, preview_url: false } })
  }

  async sendKeyboard(recipient: string, text: string, rows: KeyboardButton[][]): Promise<void> {
    const buttons = rows.flat().slice(0, 3).map((btn, i) => ({
      type: 'reply',
      reply: { id: `btn_${i}`, title: btn.text.slice(0, 20) },
    }))

    if (buttons.length === 0) {
      return this.sendText(recipient, text)
    }

    await this.sendMessage(recipient, {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: text.slice(0, 1024) },
        action: { buttons },
      },
    })
  }

  async requestContact(recipient: string): Promise<void> {
    // WhatsApp non ha un flow nativo "condividi contatto" come Telegram.
    // Gli inquilini WhatsApp vengono identificati direttamente dal loro numero mittente.
    await this.sendText(
      recipient,
      '👋 Benvenuto nel servizio inquilini!\n\nSto verificando il tuo numero... Un momento.'
    )
  }

  async removeKeyboard(recipient: string, text: string): Promise<void> {
    await this.sendText(recipient, text)
  }

  async setupWebhook(_webhookUrl: string): Promise<void> {
    // WhatsApp webhook setup avviene tramite Meta Business dashboard o Graph API
    // L'URL viene registrato una volta sola nelle impostazioni dell'app Meta
    console.log('[WhatsAppAdapter] setupWebhook: configura manualmente nella Meta Business dashboard')
  }

  private async sendMessage(recipient: string, messageBody: object): Promise<void> {
    if (!this.config.accessToken || !this.config.botToken) {
      console.error('[WhatsAppAdapter] accessToken o phone_number_id mancante')
      return
    }

    const phoneNumberId = this.config.botToken  // botToken = phone_number_id per WhatsApp

    const res = await fetch(`${GRAPH_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        ...messageBody,
      }),
    })

    if (!res.ok) {
      console.error(`[WhatsAppAdapter] send failed ${res.status}: ${await res.text()}`)
    }
  }
}
