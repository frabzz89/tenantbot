import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/PageHeader'
import { Badge } from '../../components/Badge'
import type { TicketManutenzione } from '@tenantbot/db'

type TicketRow = TicketManutenzione & {
  inquilino?: { nome: string; cognome: string } | null
  unita?: { slug: string } | null
}

const PRIORITA_VARIANT: Record<string, 'danger' | 'warning' | 'default'> = {
  P1: 'danger', P2: 'warning', P3: 'default',
}
const STATO_VARIANT: Record<string, 'warning' | 'info' | 'success' | 'default'> = {
  aperto: 'warning', in_lavorazione: 'info', risolto: 'success', chiuso: 'default', annullato: 'default',
}

export function TicketPage() {
  const { tenant } = useAuth()
  const [items, setItems] = useState<TicketRow[]>([])
  const [selected, setSelected] = useState<TicketRow | null>(null)
  const [filtroStato, setFiltroStato] = useState('')
  const [filtroPriorita, setFiltroPriorita] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!tenant) return
    let q = supabase
      .from('ticket_manutenzione')
      .select('*, inquilino:inquilino_id(nome,cognome), unita:unita_id(slug)')
      .order('created_at', { ascending: false })
    if (filtroStato) q = q.eq('stato', filtroStato)
    if (filtroPriorita) q = q.eq('priorita', filtroPriorita)
    const { data } = await q
    setItems(data ?? [])
  }

  useEffect(() => { load() }, [tenant, filtroStato, filtroPriorita])

  async function updateTicket(id: string, updates: Partial<TicketManutenzione>) {
    setSaving(true)
    await supabase.from('ticket_manutenzione').update(updates).eq('id', id)
    setSaving(false)
    load()
    if (selected?.id === id) setSelected({ ...selected, ...updates } as TicketRow)
  }

  return (
    <div className="flex h-[calc(100vh-0px)]">
      {/* Lista */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader title="Ticket Manutenzione" description="Segnalazioni ricevute tramite bot" />
        <div className="p-4 flex gap-3 border-b border-gray-100 bg-white">
          <select value={filtroStato} onChange={(e) => setFiltroStato(e.target.value)} className={`${INPUT} w-40`}>
            <option value="">Tutti gli stati</option>
            {['aperto', 'in_lavorazione', 'risolto', 'chiuso', 'annullato'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select value={filtroPriorita} onChange={(e) => setFiltroPriorita(e.target.value)} className={`${INPUT} w-32`}>
            <option value="">Tutte le priorità</option>
            {['P1', 'P2', 'P3'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {items.map((t) => (
            <div
              key={t.id}
              onClick={() => setSelected(t)}
              className={`rounded-xl border p-4 cursor-pointer transition-colors ${
                selected?.id === t.id ? 'border-brand-400 bg-brand-50' : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between mb-1">
                <div className="font-medium text-sm">
                  #{t.numero_ticket} — {(t.inquilino as { nome: string; cognome: string } | null)?.cognome} {(t.inquilino as { nome: string; cognome: string } | null)?.nome}
                </div>
                <div className="flex gap-1.5">
                  <Badge variant={PRIORITA_VARIANT[t.priorita]}>{t.priorita}</Badge>
                  <Badge variant={STATO_VARIANT[t.stato]}>{t.stato}</Badge>
                </div>
              </div>
              <div className="text-xs text-gray-500 line-clamp-2">{t.descrizione}</div>
              <div className="text-xs text-gray-400 mt-1">
                {new Date(t.created_at).toLocaleString('it-IT')} • {t.canale_origine ?? 'backoffice'}
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="py-16 text-center text-sm text-gray-400">Nessun ticket con i filtri selezionati</div>
          )}
        </div>
      </div>

      {/* Dettaglio */}
      {selected && (
        <div className="w-96 border-l border-gray-200 bg-white flex flex-col overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold">Ticket #{selected.numero_ticket}</h2>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Inquilino</div>
              <div className="text-sm">{(selected.inquilino as { nome: string; cognome: string } | null)?.cognome} {(selected.inquilino as { nome: string; cognome: string } | null)?.nome}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Descrizione</div>
              <div className="text-sm whitespace-pre-wrap">{selected.descrizione}</div>
            </div>
            <div className="flex gap-3">
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Priorità</div>
                <select
                  value={selected.priorita}
                  onChange={(e) => updateTicket(selected.id, { priorita: e.target.value as TicketManutenzione['priorita'] })}
                  className={INPUT}
                >
                  {['P1', 'P2', 'P3'].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Stato</div>
                <select
                  value={selected.stato}
                  onChange={(e) => updateTicket(selected.id, { stato: e.target.value as TicketManutenzione['stato'] })}
                  className={INPUT}
                >
                  {['aperto', 'in_lavorazione', 'risolto', 'chiuso', 'annullato'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Note admin</div>
              <textarea
                defaultValue={selected.note_admin ?? ''}
                onBlur={(e) => updateTicket(selected.id, { note_admin: e.target.value || null })}
                rows={4}
                className={INPUT + ' resize-none'}
                placeholder="Note interne..."
              />
            </div>
            {saving && <p className="text-xs text-gray-400">Salvataggio...</p>}
          </div>
        </div>
      )}
    </div>
  )
}

const INPUT = 'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-full'
