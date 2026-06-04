import type { BotConfig, ChannelAdapter, KeyboardButton, NormalizedMessage } from './types'

type TgContact = { phone_number: string; first_name: string }
type TgMessage = {
  from: { id: number; first_name?: string }
  chat: { id: number }
  text?: string
  contact?: TgContact
}
type TgUpdate = { message?: TgMessage }

const COMMANDS = new Set(['start', 'contratto', 'normativa', 'manutenzione', 'aiuto'])

export class TelegramAdapter implements ChannelAdapter {
  readonly canale = 'telegram' as const

  constructor(private config: BotConfig) {}

  validateWebhook(headers: Record<string, string | string[] | undefined>): boolean {
    if (!this.config.webhookSecret) return true
    const token = headers['x-telegram-bot-api-secret-token']
    return token === this.config.webhookSecret
  }

  parseMessage(body: unknown): NormalizedMessage | null {
    const update = body as TgUpdate
    const msg = update?.message
    if (!msg) return null
    if (!msg.from) return null  // anonymous group admin, channel post forwarded, etc.

    const senderId = String(msg.from.id)
    const text = msg.text

    if (msg.contact) {
      return {
        senderId,
        isCommand: false,
        contact: { phone: msg.contact.phone_number, firstName: msg.contact.first_name },
      }
    }

    if (!text) return null

    if (text.startsWith('/')) {
      const parts = text.slice(1).split(' ')
      const cmd = parts[0].split('@')[0].toLowerCase()
      if (COMMANDS.has(cmd)) {
        return {
          senderId,
          text,
          isCommand: true,
          command: cmd,
          commandArgs: parts.slice(1).join(' ').trim() || undefined,
        }
      }
    }

    return { senderId, text, isCommand: false }
  }

  private get chatId(): (recipient: string) => number {
    return (r) => Number(r)
  }

  async sendText(recipient: string, text: string): Promise<void> {
    await this.callApi('sendMessage', {
      chat_id: this.chatId(recipient),
      text,
      parse_mode: 'HTML',
    })
  }

  async sendKeyboard(recipient: string, text: string, rows: KeyboardButton[][]): Promise<void> {
    await this.callApi('sendMessage', {
      chat_id: this.chatId(recipient),
      text,
      parse_mode: 'HTML',
      reply_markup: {
        keyboard: rows,
        resize_keyboard: true,
        persistent: true,
      },
    })
  }

  async requestContact(recipient: string): Promise<void> {
    await this.callApi('sendMessage', {
      chat_id: this.chatId(recipient),
      text: '👋 Benvenuto!\n\nCondividi il tuo numero di telefono per accedere al servizio.',
      reply_markup: {
        keyboard: [[{ text: '📱 Condividi il mio numero', request_contact: true }]],
        one_time_keyboard: true,
        resize_keyboard: true,
      },
    })
  }

  async removeKeyboard(recipient: string, text: string): Promise<void> {
    await this.callApi('sendMessage', {
      chat_id: this.chatId(recipient),
      text,
      parse_mode: 'HTML',
      reply_markup: { remove_keyboard: true },
    })
  }

  async setupWebhook(webhookUrl: string): Promise<void> {
    const body: Record<string, string> = { url: webhookUrl }
    if (this.config.webhookSecret) body.secret_token = this.config.webhookSecret

    await this.callApi('setMyCommands', {
      commands: [
        { command: 'contratto', description: 'Domande sul mio contratto' },
        { command: 'normativa', description: 'Normativa e regolamento condominiale' },
        { command: 'manutenzione', description: 'Segnala un guasto o problema' },
        { command: 'aiuto', description: 'Come usare questo servizio' },
      ],
    })
    await this.callApi('setWebhook', body)
  }

  async getWebhookInfo(): Promise<unknown> {
    const res = await fetch(`https://api.telegram.org/bot${this.config.botToken}/getWebhookInfo`)
    return res.json()
  }

  private async callApi(method: string, body: object): Promise<void> {
    const res = await fetch(`https://api.telegram.org/bot${this.config.botToken}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      console.error(`[TelegramAdapter] ${method} failed ${res.status}: ${await res.text()}`)
    }
  }

  extractChatId(body: unknown): string | null {
    const update = body as TgUpdate
    const chatId = update?.message?.chat?.id
    return chatId != null ? String(chatId) : null
  }
}
