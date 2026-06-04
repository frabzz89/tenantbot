export type PianoTenant = 'starter' | 'pro' | 'enterprise'
export type RuoloTenantUser = 'admin' | 'membro'
export type TipoProprietа = 'residenziale' | 'commerciale' | 'misto'
export type CanaleBotType = 'telegram' | 'whatsapp'
export type StatoUnita = 'bozza' | 'pubblicata' | 'occupata' | 'archiviata'
export type LinguaInquilino = 'it' | 'en'
export type PrioritaTicket = 'P1' | 'P2' | 'P3'
export type StatoTicket = 'aperto' | 'in_lavorazione' | 'risolto' | 'chiuso' | 'annullato'
export type RoleConversazione = 'user' | 'assistant' | 'system'
export type TipoKbDocumento = 'regolamento' | 'normativa' | 'contatti' | 'orari' | 'altro'

export interface Tenant {
  id: string
  nome: string
  email_contatto: string
  piano: PianoTenant
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_status: string
  trial_ends_at: string
  attivo: boolean
  created_at: string
}

export interface TenantUser {
  id: string
  tenant_id: string
  user_id: string
  ruolo: RuoloTenantUser
  created_at: string
}

export interface Proprieta {
  id: string
  tenant_id: string
  nome: string
  indirizzo: string | null
  citta: string | null
  tipo: TipoProprietа
  attivo: boolean
  created_at: string
}

export interface BotConfigurazione {
  id: string
  tenant_id: string
  canale: CanaleBotType
  bot_token: string | null
  webhook_secret: string | null
  api_secret: string | null
  admin_chat_id: string | null
  waba_id: string | null
  access_token: string | null
  lingua_default: string
  nome_bot: string
  messaggio_benvenuto: string | null
  attivo: boolean
  created_at: string
}

export interface Unita {
  id: string
  tenant_id: string
  proprieta_id: string
  slug: string
  tipo_immobile: 'residenziale' | 'commerciale'
  interno: string | null
  piano: number | null
  mq: number | null
  locali: number | null
  bagni: number | null
  stato: StatoUnita
  descrizione: string | null
  created_at: string
  updated_at: string
}

export interface Inquilino {
  id: string
  tenant_id: string
  nome: string
  cognome: string
  codice_fiscale: string | null
  telefono_whatsapp: string | null
  email: string | null
  unita_id: string | null
  lingua: LinguaInquilino
  attivo: boolean
  data_ingresso: string | null
  data_uscita: string | null
  telegram_user_id: string | null
  whatsapp_phone: string | null
  created_at: string
}

export interface Contratto {
  id: string
  tenant_id: string
  inquilino_id: string
  unita_id: string
  pdf_storage_path: string | null
  data_firma: string
  data_inizio: string
  data_scadenza: string | null
  tipo: string | null
  canone: number
  cauzione: number | null
  iban_pagamento: string | null
  preavviso_mesi: number
  attivo: boolean
  created_at: string
}

export interface ContrattoEmbedding {
  id: number
  tenant_id: string
  contratto_id: string
  chunk_text: string
  chunk_index: number
  embedding: number[] | null
  created_at: string
}

export interface KbDocumento {
  id: string
  tenant_id: string
  proprieta_id: string | null
  tipo: TipoKbDocumento | null
  titolo: string
  contenuto: string | null
  pdf_storage_path: string | null
  attivo: boolean
  updated_at: string
}

export interface KbDocumentoEmbedding {
  id: number
  tenant_id: string
  documento_id: string
  chunk_text: string
  chunk_index: number
  embedding: number[] | null
  created_at: string
}

export interface TicketManutenzione {
  id: string
  tenant_id: string
  numero_ticket: number
  inquilino_id: string
  unita_id: string | null
  priorita: PrioritaTicket
  stato: StatoTicket
  categoria: string | null
  descrizione: string
  foto_paths: string[]
  note_admin: string | null
  canale_origine: CanaleBotType | 'backoffice' | null
  created_at: string
  resolved_at: string | null
  closed_at: string | null
}

export interface Conversazione {
  id: number
  tenant_id: string
  inquilino_id: string | null
  canale: CanaleBotType
  sender_id: string | null
  role: RoleConversazione
  messaggio: string
  intent_classificato: string | null
  confidence: number | null
  escalated: boolean
  created_at: string
}

export interface AvisoBroadcast {
  id: string
  tenant_id: string
  proprieta_id: string | null
  contenuto_it: string
  contenuto_en: string | null
  canale: CanaleBotType | 'entrambi'
  sent_at: string | null
  sent_count: number
  created_by: string | null
  created_at: string
}

export interface InquilinoProprietaRow {
  id: string
  tenant_id: string
  inquilino_id: string
  proprieta_id: string
  created_at: string
}

// Limiti per piano
export const PIANO_LIMITI = {
  starter: { proprieta: 1, unita: 30, canali: ['telegram'] as CanaleBotType[] },
  pro: { proprieta: 5, unita: 150, canali: ['telegram', 'whatsapp'] as CanaleBotType[] },
  enterprise: { proprieta: Infinity, unita: Infinity, canali: ['telegram', 'whatsapp'] as CanaleBotType[] },
} as const
