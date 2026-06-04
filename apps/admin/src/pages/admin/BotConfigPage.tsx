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
  const [settingUp, setSettingUp] = useState(false)

  async function load() {
    if (!tenant) return
    const { data } = await supabase.from('bot_configurazioni').select('*')
    setConfigs(data ?? [])
  }

  useEffect(() => { load() }, [tenant])

  async function save() {
    if (!editing || !tenant) return
    setSaving(true)
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

  async function setupWebhook(canale: 'telegram' | 'whatsapp') {
    if (!tenant) return
    setSettingUp(true)
    const apiUrl = import.meta.env.VITE_API_URL as string ?? ''
    const secret = import.meta.env.VITE_INGEST_SECRET as string ?? ''
    const res = await fetch(`${apiUrl}/api/setup/${canale}?tenant_id=${tenant.id}&secret=${secret}`)
    const data = await res.json() as { ok?: boolean; webhookUrl?: string; error?: string; istruzioni?: string[] }
    setSettingUp(false)
    if (data.ok) {
      toast.success(`Webhook ${canale} configurato: ${data.webhookUrl}`)
    } else if (data.istruzioni) {
      toast.info(data.istruzioni.join(' | '))
    } else {
      toast.error(data.error ?? 'Errore setup')
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
                          onClick={() => setupWebhook(canale)}
                          disabled={settingUp}
                          className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                        >
                          {settingUp ? 'Configurando...' : 'Setup Webhook'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {config && !isWhatsApp && (
                <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
                  <div><span className="font-medium">Nome bot:</span> {config.nome_bot}</div>
                  <div><span className="font-medium">Lingua:</span> {config.lingua_default}</div>
                  {config.admin_chat_id && (
                    <div><span className="font-medium">Admin Chat ID:</span> {config.admin_chat_id}</div>
                  )}
                  <div><span className="font-medium">Token:</span> {config.bot_token ? '••••••••' + config.bot_token.slice(-6) : '—'}</div>
                </div>
              )}

              {!config && !isWhatsApp && (
                <div className="mt-2 text-sm text-gray-400">
                  Crea un bot su @BotFather e incolla il token qui.
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
                  <Field label="Webhook Secret (opzionale, 32+ char)">
                    <input value={editing.webhook_secret ?? ''} onChange={(e) => setEditing({ ...editing, webhook_secret: e.target.value || null })} className={INPUT} />
                  </Field>
                  <Field label="Admin Chat ID (per notifiche P1)">
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
              <Field label="Messaggio di benvenuto (opzionale)">
                <textarea value={editing.messaggio_benvenuto ?? ''} onChange={(e) => setEditing({ ...editing, messaggio_benvenuto: e.target.value || null })} rows={3} className={INPUT + ' resize-none'} />
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
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>{children}</div>
}
