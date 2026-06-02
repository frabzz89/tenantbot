export interface NormalizedMessage {
  senderId: string         // Telegram user_id (stringa) | WhatsApp phone E.164
  text?: string
  contact?: { phone: string; firstName: string }
  isCommand: boolean
  command?: string         // es. 'contratto', 'normativa', 'manutenzione', 'aiuto'
  commandArgs?: string     // testo dopo il comando
}

export interface KeyboardButton {
  text: string
}

export interface ChannelAdapter {
  canale: 'telegram' | 'whatsapp'
  validateWebhook(headers: Record<string, string | string[] | undefined>, rawBody: string): boolean
  parseMessage(body: unknown): NormalizedMessage | null
  sendText(recipient: string, text: string): Promise<void>
  sendKeyboard(recipient: string, text: string, rows: KeyboardButton[][]): Promise<void>
  requestContact(recipient: string): Promise<void>
  removeKeyboard(recipient: string, text: string): Promise<void>
  setupWebhook(webhookUrl: string): Promise<void>
}

export interface BotConfig {
  tenantId: string
  canale: 'telegram' | 'whatsapp'
  botToken: string
  webhookSecret: string | null
  apiSecret: string | null
  adminChatId: string | null
  accessToken: string | null
  linguaDefault: string
  nomeBot: string
  messaggioBenvenuto: string | null
}
