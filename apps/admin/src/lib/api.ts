const API_URL = import.meta.env.VITE_API_URL as string ?? ''
const INGEST_SECRET = import.meta.env.VITE_INGEST_SECRET as string ?? ''

export async function ingestContratto(contrattoId: string, tenantId: string, testo: string) {
  const res = await fetch(`${API_URL}/api/ingest/contratto`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${INGEST_SECRET}`,
    },
    body: JSON.stringify({ contratto_id: contrattoId, tenant_id: tenantId, testo }),
  })
  return res.json() as Promise<{ ok: boolean; chunks?: number; error?: string }>
}

export async function ingestKbDocumento(documentoId: string, tenantId: string, testo?: string) {
  const res = await fetch(`${API_URL}/api/ingest/kb-documento`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${INGEST_SECRET}`,
    },
    body: JSON.stringify({ documento_id: documentoId, tenant_id: tenantId, testo }),
  })
  return res.json() as Promise<{ ok: boolean; chunks?: number; source?: string; error?: string }>
}

export async function createTenant(userId: string, nome: string, email: string) {
  const res = await fetch(`${API_URL}/api/admin/tenant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, nome, email }),
  })
  return res.json() as Promise<{ ok: boolean; tenant_id?: string; error?: string }>
}
