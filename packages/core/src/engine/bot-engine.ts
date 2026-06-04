import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChannelAdapter, KeyboardButton, NormalizedMessage } from '../channels/types'
import type { BotConfig } from '../channels/types'
import { anthropicChat, voyageEmbed } from '../ai'

// ─── Keyboard principale (internazionalizzata) ────────────────────────────────

const MAIN_KEYBOARD: KeyboardButton[][] = [
  [{ text: '📄 Il mio contratto' }, { text: '⚖️ Normativa' }],
  [{ text: '🔧 Manutenzione' }, { text: '📞 Parla con noi' }],
]

// ─── Pattern domande strutturate ─────────────────────────────────────────────

const STRUCTURED_PATTERNS = [
  { pattern: /canone|affitto|quanto pago|rata mensile|importo/i, field: 'canone' },
  { pattern: /scade|scadenza|quando finisce|durata|fine contratto/i, field: 'data_scadenza' },
  { pattern: /cauzione|deposito/i, field: 'cauzione' },
  { pattern: /preavviso|disdetta|recesso/i, field: 'preavviso_mesi' },
  { pattern: /iban|conto|pagamento|bonifico/i, field: 'iban_pagamento' },
]

type Intent =
  | 'contract_question_structured'
  | 'contract_question_rag'
  | 'law_question'
  | 'maintenance_ticket'
  | 'maintenance_confirm'
  | 'escalation'
  | 'other'

type InquilinoCtx = {
  id: string
  nome: string
  lingua: 'it' | 'en'
  unita_id: string | null
  telefono_whatsapp: string | null
  proprieta_id: string | null
}

export interface BotEngineConfig {
  supabase: SupabaseClient
  adapter: ChannelAdapter
  botConfig: BotConfig
  voyageApiKey: string
  anthropicApiKey: string
  resendApiKey: string
  resendFromEmail: string
  adminEmail: string
}

export class BotEngine {
  constructor(private cfg: BotEngineConfig) {}

  private get db() { return this.cfg.supabase }
  private get adapter() { return this.cfg.adapter }
  private get tenantId() { return this.cfg.botConfig.tenantId }

  // ─── Entry point: gestisci un messaggio in ingresso ───────────────────────

  async handleMessage(message: NormalizedMessage, recipient: string): Promise<void> {
    const senderId = message.senderId

    // Lookup inquilino per sender_id (telegram_user_id o whatsapp_phone)
    const inquilino = await this.lookupInquilino(senderId)

    if (!inquilino) {
      // Flusso registrazione
      if (message.contact) {
        await this.handleContactLink(recipient, senderId, message.contact)
      } else {
        await this.handleUnknownUser(recipient, message)
      }
      return
    }

    if (message.text) {
      await this.handleConversation(inquilino, recipient, message)
    }
  }

  // ─── Utente non riconosciuto: benvenuto + richiesta contatto ──────────────

  private async handleUnknownUser(recipient: string, message: NormalizedMessage) {
    const isStart = message.isCommand && message.command === 'start'
    const nomBot = this.cfg.botConfig.nomeBot ?? 'TenantBot'

    if (isStart) {
      // Prima di chiedere il numero, spieghiamo cos'è il bot
      await this.adapter.sendText(
        recipient,
        `👋 Benvenuto su <b>${nomBot}</b>!\n\n` +
        `Sono il tuo assistente digitale per:\n` +
        `📄 Informazioni sul tuo contratto\n` +
        `⚖️ Normativa condominiale\n` +
        `🔧 Segnalazioni di manutenzione\n\n` +
        `Per continuare, condividi il tuo numero di telefono con il pulsante qui sotto. ` +
        `Il numero deve essere lo stesso comunicato all'amministratore.`
      )
    }

    await this.adapter.requestContact(recipient)
  }

  // ─── Lookup inquilino per canale ──────────────────────────────────────────

  private async lookupInquilino(senderId: string): Promise<InquilinoCtx | null> {
    const field = this.cfg.adapter.canale === 'telegram' ? 'telegram_user_id' : 'telefono_whatsapp'
    // WhatsApp senderId arriva senza +, normalizza
    const lookup = this.cfg.adapter.canale === 'whatsapp' && !senderId.startsWith('+')
      ? '+' + senderId
      : senderId

    const { data } = await this.db
      .from('inquilini')
      .select('id, nome, lingua, unita_id, telefono_whatsapp, unita:unita_id(proprieta_id)')
      .eq('tenant_id', this.tenantId)
      .eq(field, lookup)
      .eq('attivo', true)
      .single()

    if (!data) return null

    const rec = data as typeof data & { unita?: { proprieta_id: string } | null }
    return {
      id: rec.id,
      nome: rec.nome,
      lingua: rec.lingua as 'it' | 'en',
      unita_id: rec.unita_id,
      telefono_whatsapp: rec.telefono_whatsapp,
      proprieta_id: rec.unita?.proprieta_id ?? null,
    }
  }

  // ─── Registrazione inquilino tramite contatto condiviso ───────────────────

  private async handleContactLink(
    recipient: string,
    senderId: string,
    contact: { phone: string; firstName: string }
  ) {
    const phone = '+' + contact.phone.replace(/\D/g, '')

    const { data: inq } = await this.db
      .from('inquilini')
      .select('id, nome, attivo')
      .eq('tenant_id', this.tenantId)
      .eq('telefono_whatsapp', phone)
      .single()

    if (!inq) {
      await this.adapter.removeKeyboard(recipient, '❌ Numero non trovato. Contatta l\'amministrazione per essere registrato.')
      return
    }
    if (!inq.attivo) {
      await this.adapter.removeKeyboard(recipient, '❌ Il tuo accesso non è attivo. Contatta l\'amministrazione.')
      return
    }

    const field = this.cfg.adapter.canale === 'telegram' ? 'telegram_user_id' : 'whatsapp_phone'
    await this.db.from('inquilini').update({ [field]: senderId }).eq('id', inq.id)

    await this.adapter.sendKeyboard(
      recipient,
      `✅ Collegato! Ciao <b>${inq.nome}</b> 👋\n\nPuoi usare i pulsanti qui sotto oppure scrivermi liberamente.`,
      MAIN_KEYBOARD
    )
  }

  // ─── Loop conversazionale ─────────────────────────────────────────────────

  private async handleConversation(
    inquilino: InquilinoCtx,
    recipient: string,
    message: NormalizedMessage
  ) {
    const text = message.text!

    // 1. Comandi slash / pulsanti keyboard
    if (message.isCommand || this.isKeyboardButton(text)) {
      const handled = await this.handleCommandOrButton(inquilino, recipient, message)
      if (handled) return
    }

    // 2. Stato pending
    const pendingState = await this.getPendingState(inquilino.id)

    if (pendingState === 'command_contratto' || pendingState === 'command_normativa') {
      await this.clearPendingState(inquilino.id, pendingState)
      const reply = await this.handleLawQuestion(inquilino, text)
      await this.adapter.sendKeyboard(recipient, reply, MAIN_KEYBOARD)
      await this.storeConversazione(inquilino.id, text, reply, 'law_question', message)
      return
    }

    const hasPendingTicket = pendingState === 'maintenance_pending'

    // 3. Intent classification
    const intent = await this.classifyIntent(text, hasPendingTicket)

    let reply: string

    switch (intent) {
      case 'contract_question_structured':
        reply = await this.handleStructuredQuestion(inquilino, text)
        break
      case 'contract_question_rag':
      case 'law_question':
        reply = await this.handleLawQuestion(inquilino, text)
        break
      case 'maintenance_ticket':
        await this.handleMaintenanceRequest(inquilino, recipient, text)
        return
      case 'maintenance_confirm':
        reply = await this.handleMaintenanceConfirm(inquilino, recipient, text)
        break
      case 'escalation': {
        await this.db.from('conversazioni').insert({
          tenant_id: this.tenantId,
          inquilino_id: inquilino.id,
          canale: this.cfg.adapter.canale,
          sender_id: inquilino.telefono_whatsapp ?? '',
          role: 'user',
          messaggio: text,
          intent_classificato: 'escalation',
          escalated: true,
        })
        await this.sendEscalationEmail(inquilino.nome, text)
        reply = '📞 Ho segnalato la tua richiesta. L\'amministrazione ti contatterà al più presto.'
        await this.adapter.sendKeyboard(recipient, reply, MAIN_KEYBOARD)
        return
      }
      default:
        reply = 'Non riesco ad aiutarti con questo. Usa i pulsanti qui sotto o contatta direttamente l\'amministrazione.'
    }

    await this.adapter.sendKeyboard(recipient, reply, MAIN_KEYBOARD)
    await this.storeConversazione(inquilino.id, text, reply, intent, message)
  }

  // ─── Comandi slash + pulsanti keyboard ───────────────────────────────────

  private isKeyboardButton(text: string): boolean {
    return ['📄 il mio contratto', '⚖️ normativa', '🔧 manutenzione', '📞 parla con noi']
      .includes(text.toLowerCase())
  }

  private async handleCommandOrButton(
    inquilino: InquilinoCtx,
    recipient: string,
    message: NormalizedMessage
  ): Promise<boolean> {
    const cmd = message.command ?? message.text?.toLowerCase().replace(/[📄⚖️🔧📞]/gu, '').trim()

    if (cmd === 'aiuto' || cmd === 'ℹ️ aiuto') {
      await this.adapter.sendKeyboard(
        recipient,
        `ℹ️ <b>Come posso aiutarti?</b>\n\n` +
        `📄 <b>Il mio contratto</b> — canone, scadenza, clausole, cauzione\n` +
        `⚖️ <b>Normativa</b> — regolamento condominiale, leggi sulle locazioni\n` +
        `🔧 <b>Manutenzione</b> — segnala un guasto o problema tecnico\n` +
        `📞 <b>Parla con noi</b> — richiedi di essere contattato dall\'amministrazione`,
        MAIN_KEYBOARD
      )
      return true
    }

    if (cmd === 'contratto' || message.text?.toLowerCase() === '📄 il mio contratto') {
      const args = message.commandArgs
      if (args) {
        const reply = await this.handleLawQuestion(inquilino, args)
        await this.adapter.sendKeyboard(recipient, reply, MAIN_KEYBOARD)
        await this.storeConversazione(inquilino.id, args, reply, 'law_question', message)
      } else {
        await this.setPendingState(inquilino.id, 'command_contratto')
        await this.adapter.removeKeyboard(recipient, '📄 Su cosa vuoi informazioni riguardo al tuo contratto?\n\n<i>Es. clausole sugli animali, spese incluse, possibilità di sublocare…</i>')
      }
      return true
    }

    if (cmd === 'normativa' || message.text?.toLowerCase() === '⚖️ normativa') {
      const args = message.commandArgs
      if (args) {
        const reply = await this.handleLawQuestion(inquilino, args)
        await this.adapter.sendKeyboard(recipient, reply, MAIN_KEYBOARD)
        await this.storeConversazione(inquilino.id, args, reply, 'law_question', message)
      } else {
        await this.setPendingState(inquilino.id, 'command_normativa')
        await this.adapter.removeKeyboard(recipient, '⚖️ Su quale argomento normativo vuoi informazioni?\n\n<i>Es. regolamento condominiale, legge 431/98, cedolare secca…</i>')
      }
      return true
    }

    if (cmd === 'manutenzione' || message.text?.toLowerCase() === '🔧 manutenzione') {
      await this.handleMaintenanceRequest(inquilino, recipient, message.text ?? '🔧 manutenzione')
      return true
    }

    if (message.text?.toLowerCase() === '📞 parla con noi') {
      // Tratta come escalation → lascia al loop
      return false
    }

    if (cmd === 'start') {
      const benvenuto = this.cfg.botConfig.messaggioBenvenuto
      await this.adapter.sendKeyboard(
        recipient,
        benvenuto ?? `Ciao <b>${inquilino.nome}</b>! Come posso aiutarti?`,
        MAIN_KEYBOARD
      )
      return true
    }

    return false
  }

  // ─── Intent classification ────────────────────────────────────────────────

  private async classifyIntent(text: string, pendingTicket: boolean): Promise<Intent> {
    if (pendingTicket) return 'maintenance_confirm'
    if (STRUCTURED_PATTERNS.some((p) => p.pattern.test(text))) return 'contract_question_structured'

    const raw = await anthropicChat(
      [{
        role: 'user',
        content: `Classifica in uno di questi intent (rispondi solo col nome):
contract_question = domanda sul contratto di locazione (clausole, obblighi, diritti, sublocazione)
law_question = domanda su normativa italiana o regolamento condominiale
maintenance_ticket = segnalazione guasto o problema tecnico
escalation = vuole parlare con una persona o reclamo
other = altro

Messaggio: "${text.slice(0, 300)}"`,
      }],
      15,
      this.cfg.anthropicApiKey
    )

    const n = raw.toLowerCase()
    if (n.includes('contract')) return 'contract_question_rag'
    if (n.includes('law')) return 'law_question'
    if (n.includes('maintenance')) return 'maintenance_ticket'
    if (n.includes('escalation')) return 'escalation'

    // Fallback keyword
    if (/subaffitt|sublocaz|animali|pet|clausola|normativa|legge|regolamento|condominio|cedolare/i.test(text)) return 'law_question'
    if (/obbligo|rescissione|recesso anticipato|lavori|intervento/i.test(text)) return 'contract_question_rag'
    if (/guasto|rotto|perdita|allagamento|non funziona|rottura|infiltraz/i.test(text)) return 'maintenance_ticket'
    if (/parlare con|umano|persona|admin|reclamo|voglio contattare/i.test(text)) return 'escalation'
    return 'other'
  }

  // ─── Handler: domanda strutturata su contratto ────────────────────────────

  private async handleStructuredQuestion(inquilino: InquilinoCtx, text: string): Promise<string> {
    const { data: contratto } = await this.db
      .from('contratti')
      .select('canone, cauzione, data_scadenza, preavviso_mesi, iban_pagamento, data_inizio, tipo')
      .eq('tenant_id', this.tenantId)
      .eq('inquilino_id', inquilino.id)
      .eq('attivo', true)
      .single()

    if (!contratto) return 'Non ho trovato un contratto attivo. Contatta l\'amministrazione.'

    const matched = STRUCTURED_PATTERNS.find((p) => p.pattern.test(text))
    const field = matched?.field
    const lines: string[] = []

    if (!field || field === 'canone') {
      if (contratto.canone) {
        const mensile = (Number(contratto.canone) / 12).toLocaleString('it-IT', { maximumFractionDigits: 2 })
        const annuale = Number(contratto.canone).toLocaleString('it-IT')
        lines.push(`💶 Canone mensile: €${mensile} (annuale: €${annuale})`)
      }
    }
    if (!field || field === 'data_scadenza') {
      if (contratto.data_scadenza) lines.push(`📅 Scadenza: ${new Date(contratto.data_scadenza).toLocaleDateString('it-IT')}`)
    }
    if (!field || field === 'cauzione') {
      if (contratto.cauzione) lines.push(`🏦 Cauzione: €${Number(contratto.cauzione).toLocaleString('it-IT')}`)
    }
    if (!field || field === 'preavviso_mesi') {
      lines.push(`📋 Preavviso disdetta: ${contratto.preavviso_mesi} mesi`)
    }
    if (field === 'iban_pagamento') {
      lines.push(contratto.iban_pagamento ? `🏧 IBAN: <code>${contratto.iban_pagamento}</code>` : 'IBAN non registrato.')
    }

    return lines.filter(Boolean).join('\n') || 'Dato non disponibile per questo contratto.'
  }

  // ─── Handler: RAG contratto + normativa ──────────────────────────────────

  private async handleLawQuestion(inquilino: InquilinoCtx, text: string): Promise<string> {
    const embedding = await voyageEmbed(text, this.cfg.voyageApiKey)
    if (!embedding) return 'Errore tecnico. Riprova tra qualche minuto.'

    const [contractRes, kbRes] = await Promise.all([
      this.db.rpc('match_contratto_chunks', {
        p_tenant_id: this.tenantId,
        p_inquilino_id: inquilino.id,
        p_query_embedding: embedding,
        p_match_count: 3,
        p_match_threshold: 0.25,
      }),
      this.db.rpc('match_kb_documenti', {
        p_tenant_id: this.tenantId,
        p_proprieta_id: inquilino.proprieta_id,
        p_query_embedding: embedding,
        p_match_count: 3,
        p_match_threshold: 0.25,
      }),
    ])

    const contractChunks = (contractRes.data ?? []) as { chunk_text: string }[]
    const kbDocs = (kbRes.data ?? []) as { titolo: string; contenuto: string }[]

    if (contractChunks.length === 0 && kbDocs.length === 0) {
      return 'Non ho trovato documentazione pertinente. Contatta l\'amministrazione per maggiori informazioni.'
    }

    const contractCtx = contractChunks.length > 0
      ? `## Clausole del contratto dell'inquilino\n${contractChunks.map((c) => c.chunk_text).join('\n---\n')}`
      : ''
    const kbCtx = kbDocs.length > 0
      ? kbDocs.map((d) => `## ${d.titolo}\n${d.contenuto}`).join('\n\n---\n\n')
      : ''
    const context = [contractCtx, kbCtx].filter(Boolean).join('\n\n===\n\n')
    const lang = inquilino.lingua === 'en' ? 'English' : 'italiano'

    const reply = await anthropicChat(
      [{
        role: 'user',
        content: `Sei un assistente per inquilini. Rispondi in base ai documenti.
⚠️ Se il contratto contiene una clausola specifica, ha PRIORITÀ sulla normativa generica.
Non inventare. Sii conciso. Rispondi in ${lang}.

Documenti:
${context}

Domanda: ${text}`,
      }],
      500,
      this.cfg.anthropicApiKey
    )

    return reply || 'Non ho trovato una risposta chiara. Contatta l\'amministrazione.'
  }

  // ─── Handler: segnalazione manutenzione ──────────────────────────────────

  private async handleMaintenanceRequest(inquilino: InquilinoCtx, recipient: string, text: string) {
    let responsabilityInfo = ''
    const embedding = await voyageEmbed(text, this.cfg.voyageApiKey)
    if (embedding) {
      const { data: kbDocs } = await this.db.rpc('match_kb_documenti', {
        p_tenant_id: this.tenantId,
        p_proprieta_id: inquilino.proprieta_id,
        p_query_embedding: embedding,
        p_match_count: 3,
        p_match_threshold: 0.25,
      })
      if (kbDocs && (kbDocs as { titolo: string; contenuto: string }[]).length > 0) {
        const ctx = (kbDocs as { titolo: string; contenuto: string }[])
          .map((d) => `## ${d.titolo}\n${d.contenuto}`).join('\n\n---\n\n')
        const info = await anthropicChat(
          [{
            role: 'user',
            content: `In 1-2 frasi, basandoti SOLO su questi documenti, dimmi se questo è responsabilità dell'inquilino o del proprietario. Se non ci sono info, rispondi stringa vuota.

Documenti:
${ctx}

Problema: ${text}`,
          }],
          150,
          this.cfg.anthropicApiKey
        )
        if (info && info.length > 10) responsabilityInfo = info
      }
    }

    await this.setPendingState(inquilino.id, 'maintenance_pending')

    let msg = '🔧 <b>Richiesta di manutenzione</b>\n\n'
    if (responsabilityInfo) msg += `ℹ️ ${responsabilityInfo}\n\n`
    msg += 'Descrivi il problema nel dettaglio (dove, quando è apparso).\n💡 Se è un\'<b>emergenza</b> (allagamento, gas, guasto elettrico), inizia con <b>URGENTE</b>.'

    await this.adapter.removeKeyboard(recipient, msg)
  }

  private async handleMaintenanceConfirm(inquilino: InquilinoCtx, _recipient: string, text: string): Promise<string> {
    const isUrgent = /^urgente/i.test(text.trim())
    const priorita = isUrgent ? 'P1' : 'P2'

    const { data: ticket, error } = await this.db
      .from('ticket_manutenzione')
      .insert({
        tenant_id: this.tenantId,
        inquilino_id: inquilino.id,
        unita_id: inquilino.unita_id,
        priorita,
        stato: 'aperto',
        descrizione: text,
        canale_origine: this.cfg.adapter.canale,
      })
      .select('numero_ticket')
      .single()

    if (error) return 'Errore nell\'apertura della richiesta. Riprova o contatta l\'amministrazione.'

    await this.clearPendingState(inquilino.id, 'maintenance_pending')

    if (isUrgent && ticket?.numero_ticket && this.cfg.botConfig.adminChatId) {
      await this.notifyAdminTelegram(inquilino.nome, text, ticket.numero_ticket)
    }

    if (isUrgent) {
      return `🚨 Richiesta <b>urgente</b> #${ticket?.numero_ticket} registrata. L\'amministrazione sarà avvisata immediatamente.`
    }
    return `✅ Richiesta #${ticket?.numero_ticket} registrata. L\'amministrazione ti contatterà entro 48 ore.`
  }

  // ─── Stato pending ────────────────────────────────────────────────────────

  private async getPendingState(inquilinoId: string): Promise<string | null> {
    const { data } = await this.db
      .from('conversazioni')
      .select('intent_classificato')
      .eq('tenant_id', this.tenantId)
      .eq('inquilino_id', inquilinoId)
      .eq('role', 'system')
      .in('intent_classificato', ['maintenance_pending', 'command_contratto', 'command_normativa'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    return data?.intent_classificato ?? null
  }

  private async setPendingState(inquilinoId: string, state: string) {
    await this.db.from('conversazioni').insert({
      tenant_id: this.tenantId,
      inquilino_id: inquilinoId,
      canale: this.cfg.adapter.canale,
      role: 'system',
      messaggio: state,
      intent_classificato: state,
    })
  }

  private async clearPendingState(inquilinoId: string, state: string) {
    await this.db
      .from('conversazioni')
      .delete()
      .eq('tenant_id', this.tenantId)
      .eq('inquilino_id', inquilinoId)
      .eq('role', 'system')
      .eq('intent_classificato', state)
  }

  // ─── Store conversazione ──────────────────────────────────────────────────

  private async storeConversazione(
    inquilinoId: string,
    userText: string,
    botReply: string,
    intent: string,
    message: NormalizedMessage
  ) {
    await this.db.from('conversazioni').insert([
      {
        tenant_id: this.tenantId,
        inquilino_id: inquilinoId,
        canale: this.cfg.adapter.canale,
        sender_id: message.senderId,
        role: 'user',
        messaggio: userText,
        intent_classificato: intent,
      },
      {
        tenant_id: this.tenantId,
        inquilino_id: inquilinoId,
        canale: this.cfg.adapter.canale,
        sender_id: message.senderId,
        role: 'assistant',
        messaggio: botReply,
        intent_classificato: intent,
      },
    ])
  }

  // ─── Notifiche ────────────────────────────────────────────────────────────

  private async notifyAdminTelegram(nome: string, descrizione: string, ticketNum: number) {
    const adminChatId = this.cfg.botConfig.adminChatId
    if (!adminChatId) return

    // Notifica tramite il bot Telegram del tenant (se il canale è Telegram)
    // altrimenti usa una API call diretta se botToken è disponibile
    if (this.cfg.adapter.canale === 'telegram') {
      await this.adapter.sendText(
        adminChatId,
        `🚨 <b>EMERGENZA — Ticket #${ticketNum}</b>\n\nInquilino: <b>${nome}</b>\n\nProblema: ${descrizione}`
      )
    }
  }

  private async sendEscalationEmail(nome: string, text: string) {
    if (!this.cfg.resendApiKey || !this.cfg.adminEmail) return
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.cfg.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.cfg.resendFromEmail,
        to: this.cfg.adminEmail,
        subject: `⚠️ Escalation richiesta: ${nome}`,
        html: `<p>L'inquilino <strong>${nome}</strong> ha richiesto assistenza umana tramite ${this.cfg.adapter.canale}.</p>
<p><strong>Messaggio:</strong><br>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
<p>Accedi al backoffice per vedere la conversazione completa.</p>`,
      }),
    })
  }
}
