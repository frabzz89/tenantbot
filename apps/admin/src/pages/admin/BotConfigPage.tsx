import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/PageHeader'
import { Badge } from '../../components/Badge'
import { TelegramIcon, WhatsAppIcon } from '../../components/icons'
import type { BotConfigurazione } from '@tenantbot/db'
import { toast } from 'sonner'

export function BotConfigPage() {
  const { tenant } = useAuth()
  const [configs, setConfigs] = useState<BotConfigurazione[]>([])
  const [editing, setEditing] = useState<Partial<BotConfigurazione> | null>(null)
  const [saving, setSaving] = useState(false)
  const [diagnosing, setDiagnosing] = useState(false)
  const [diagResult, setDiagResult] = useState<string | null>(null)

  async function load() {
    if (!tenant) return
    const { data } = await supabase.from('bot_configurazioni').select('*')
    setConfigs(data ?? [])
  }

  useEffect(() => { load() }, [tenant])

  async function save() {
    if (!editing || !tenant) return
    setSaving(true)

    // For Telegram with a token: use activate-bot which saves + registers webhook in one step
    if (editing.canale === 'telegram' && editing.bot_token) {
      const apiUrl = import.meta.env.VITE_API_URL as string ?? ''
      try {
        const res = await fetch(`${apiUrl}/api/admin/activate-bot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_id: tenant.id,
            bot_token: editing.bot_token,
            nome_bot: editing.nome_bot ?? 'TenantBot',
          }),
        })
        const data = await res.json() as { ok?: boolean; webhookUrl?: string; error?: string }
        setSaving(false)
        if (!data.ok) { toast.error(data.error ?? 'Errore attivazione bot'); return }
        // Also persist extra fields (admin_chat_id, messaggio_benvenuto, lingua) that activate-bot doesn't handle
        if (editing.admin_chat_id !== undefined || editing.messaggio_benvenuto !== undefined || editing.lingua_default !== undefined) {
          await supabase.from('bot_configurazioni')
            .update({
              admin_chat_id: editing.admin_chat_id ?? null,
              messaggio_benvenuto: editing.messaggio_benvenuto ?? null,
              lingua_default: editing.lingua_default ?? 'it',
            })
            .eq('tenant_id', tenant.id)
            .eq('canale', 'telegram')
        }
        toast.success(`Bot attivato e webhook registrato ✅`)
        setEditing(null); load()
        return
      } catch {
        setSaving(false)
        toast.error('Errore di rete')
        return
      }
    }

    // Fallback: direct Supabase upsert (WhatsApp or config-only edits)
    const { id, ...rest } = editing
    const payload = { ...rest, tenant_id: tenant.id }
    const { error } = id
      ? await supabase.from('bot_configurazioni').update(payload).eq('id', id)
      : await supabase.from('bot_configurazioni').insert(payload)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Configurazione salvata')
    setEditing(null); load()
  }

  async function runDiagnostic() {
    if (!tenant) return
    setDiagnosing(true)
    setDiagResult(null)
    try {
      const apiUrl = import.meta.env.VITE_API_URL as string ?? ''
      const res = await fetch(`${apiUrl}/api/admin/bot-diagnostic?tenant_id=${tenant.id}`)
      const data = await res.json() as {
        db?: { attivo: boolean; nome_bot: string; bot_token_suffix: string | null; webhook_secret_prefix: string | null }
        diagnosis?: { expectedWebhookUrl: string; registeredUrl: string | null; urlMatch: boolean; lastTelegramError: string | null; pendingUpdates: number | null; recommendation: string }
      }
      if (data.diagnosis) {
        const d = data.diagnosis
        const lines = [
          `Webhook atteso: ${d.expectedWebhookUrl}`,
          `Webhook registrato: ${d.registeredUrl ?? '(nessuno)'}`,
          `URL corretto: ${d.urlMatch ? '✅' : '❌'}`,
          d.lastTelegramError ? `Ultimo errore Telegram: ${d.lastTelegramError}` : null,
          d.pendingUpdates != null ? `Update in coda: ${d.pendingUpdates}` : null,
          '',
          d.recommendation,
        ].filter(Boolean).join('\n')
        setDiagResult(lines)
      }
    } catch (e) {
      setDiagResult('Errore di rete durante la diagnostica.')
    } finally {
      setDiagnosing(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Configurazione Bot"
        description="Configura i canali Telegram e WhatsApp per il tuo bot"
      />

      <div className="p-8 space-y-6">
        {(['telegram', 'whatsapp'] as const).map((canale) => {
          const config = configs.find((c) => c.canale === canale)
          const isWhatsApp = canale === 'whatsapp'

          return (
            <div key={canale} className={`rounded-xl border border-gray-200 bg-white p-6 ${isWhatsApp ? 'opacity-70' : ''}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {isWhatsApp
                    ? <WhatsAppIcon size={36} />
                    : <TelegramIcon size={36} />
                  }
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold capitalize">{canale}</span>
                      {isWhatsApp && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 font-semibold uppercase tracking-wide">
                          Presto disponibile
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {isWhatsApp ? 'Meta WhatsApp Business Cloud API' : 'Telegram Bot API'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={config?.attivo ? 'success' : 'default'}>
                    {config?.attivo ? 'Attivo' : 'Non configurato'}
                  </Badge>
                  {!isWhatsApp && (
                    <>
                      <button
                        onClick={() => setEditing(config ?? { canale, attivo: false, nome_bot: 'TenantBot', lingua_default: 'it' })}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
                      >
                        {config ? 'Modifica' : 'Configura'}
                      </button>
                      {config?.attivo && (
                        <button
                          onClick={runDiagnostic}
                          disabled={diagnosing}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
                        >
                          {diagnosing ? '...' : '🔍 Diagnostica'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {config && !isWhatsApp && (
                <>
                  <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
                    <div><span className="font-medium">Nome bot:</span> {config.nome_bot}</div>
                    <div><span className="font-medium">Lingua:</span> {config.lingua_default}</div>
                    {config.admin_chat_id && (
                      <div><span className="font-medium">Admin Chat ID:</span> {config.admin_chat_id}</div>
                    )}
                    <div><span className="font-medium">Token:</span> {config.bot_token ? '••••••••' + config.bot_token.slice(-6) : '—'}</div>
                  </div>
                  {diagResult && (
                    <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 p-3">
                      <div className="text-xs font-semibold text-gray-700 mb-1">Risultato diagnostica:</div>
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono leading-relaxed">{diagResult}</pre>
                    </div>
                  )}
                </>
              )}

              {!config && !isWhatsApp && (
                <div className="mt-2 text-sm text-gray-400">
                  Crea un bot su @BotFather e incolla il token qui.
                </div>
              )}

              {config?.attivo && !isWhatsApp && (
                <div className="mt-4 rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-700 space-y-1 leading-relaxed">
                  <p className="font-semibold">📱 Come funziona per gli inquilini:</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-blue-600">
                    <li>L'inquilino apre il bot su Telegram e invia <code className="bg-blue-100 px-1 rounded">/start</code></li>
                    <li>Il bot mostra una spiegazione e chiede di condividere il numero di telefono</li>
                    <li>L'inquilino preme "Condividi il mio numero" — il bot lo abbina all'anagrafica</li>
                    <li>Da quel momento tutti i comandi (<code className="bg-blue-100 px-1 rounded">/contratto</code>, <code className="bg-blue-100 px-1 rounded">/normativa</code>, ecc.) funzionano</li>
                  </ol>
                  <p className="text-blue-500 pt-1">⚠️ I comandi non funzionano finché l'inquilino non ha completato il passo 3.</p>
                </div>
              )}

              {isWhatsApp && (
                <div className="mt-2 text-sm text-gray-400">
                  Il supporto WhatsApp Business è in arrivo. Al lancio utilizzeremo un BSP (Business Solution Provider) per semplificare la configurazione.
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Dialog modifica */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4">Configura {editing.canale}</h2>
            <div className="space-y-3">
              {editing.canale === 'telegram' ? (
                <>
                  <Field label="Bot Token (da @BotFather)">
                    <input value={editing.bot_token ?? ''} onChange={(e) => setEditing({ ...editing, bot_token: e.target.value })} className={INPUT} placeholder="8888179292:AAFYnVb..." />
                  </Field>
                  <Field
                    label="Admin Chat ID (per notifiche urgenti)"
                    hint="Il tuo ID Telegram personale. Quando un inquilino segnala un'emergenza (ticket P1), il bot ti scrive direttamente. Per trovarlo: scrivi /start a @userinfobot su Telegram."
                  >
                    <input value={editing.admin_chat_id ?? ''} onChange={(e) => setEditing({ ...editing, admin_chat_id: e.target.value || null })} className={INPUT} placeholder="123456789" />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Phone Number ID">
                    <input value={editing.bot_token ?? ''} onChange={(e) => setEditing({ ...editing, bot_token: e.target.value })} className={INPUT} />
                  </Field>
                  <Field label="WhatsApp Business Account ID">
                    <input value={editing.waba_id ?? ''} onChange={(e) => setEditing({ ...editing, waba_id: e.target.value || null })} className={INPUT} />
                  </Field>
                  <Field label="Access Token (System User)">
                    <input value={editing.access_token ?? ''} onChange={(e) => setEditing({ ...editing, access_token: e.target.value || null })} className={INPUT} />
                  </Field>
                  <Field label="App Secret (per verifica firma webhook)">
                    <input value={editing.api_secret ?? ''} onChange={(e) => setEditing({ ...editing, api_secret: e.target.value || null })} className={INPUT} />
                  </Field>
                  <Field label="Webhook Verify Token">
                    <input value={editing.webhook_secret ?? ''} onChange={(e) => setEditing({ ...editing, webhook_secret: e.target.value || null })} className={INPUT} />
                  </Field>
                </>
              )}
              <Field label="Nome bot">
                <input value={editing.nome_bot ?? 'TenantBot'} onChange={(e) => setEditing({ ...editing, nome_bot: e.target.value })} className={INPUT} />
              </Field>
              <Field
                label="Messaggio di benvenuto (opzionale)"
                hint="Mostrato agli inquilini già collegati quando inviano /start. Se vuoto, il bot dice: «Ciao [nome]! Come posso aiutarti?». Non sostituisce la spiegazione mostrata ai nuovi utenti."
              >
                <textarea value={editing.messaggio_benvenuto ?? ''} onChange={(e) => setEditing({ ...editing, messaggio_benvenuto: e.target.value || null })} rows={3} className={INPUT + ' resize-none'} placeholder="Es. Ciao! Sono qui per aiutarti con contratto, normativa e manutenzione." />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.attivo ?? false} onChange={(e) => setEditing({ ...editing, attivo: e.target.checked })} />
                Attivo
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-600">Annulla</button>
              <button onClick={save} disabled={saving} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                {saving ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const INPUT = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400 leading-relaxed">{hint}</p>}
    </div>
  )
}
