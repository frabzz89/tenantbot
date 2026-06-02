-- ============================================================
-- TenantBot — Migration 0001: Schema multi-tenant completo
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists vector;

-- ============================================================
-- MULTI-TENANCY FOUNDATION
-- ============================================================

create table tenants (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email_contatto text not null,
  piano text not null check (piano in ('starter', 'pro', 'enterprise')) default 'starter',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  subscription_status text not null default 'trialing',
  trial_ends_at timestamptz not null default now() + interval '14 days',
  attivo boolean not null default true,
  created_at timestamptz not null default now()
);

create table tenant_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ruolo text not null check (ruolo in ('admin', 'membro')) default 'membro',
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create index idx_tenant_users_user on tenant_users(user_id);
create index idx_tenant_users_tenant on tenant_users(tenant_id);

-- Helper RLS: ritorna il tenant_id dell'utente loggato
create or replace function current_tenant_id() returns uuid as $$
  select tenant_id from tenant_users where user_id = auth.uid() limit 1
$$ language sql stable security definer;

-- Helper RLS: verifica ruolo admin nel tenant corrente
create or replace function is_tenant_admin() returns boolean as $$
  select exists(
    select 1 from tenant_users
    where user_id = auth.uid()
      and ruolo = 'admin'
  )
$$ language sql stable security definer;

-- Helper RLS: verifica appartenenza al tenant corrente
create or replace function is_tenant_member() returns boolean as $$
  select exists(select 1 from tenant_users where user_id = auth.uid())
$$ language sql stable security definer;

-- ============================================================
-- PROPRIETA (generalizza "palazzi")
-- ============================================================

create table proprieta (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  nome text not null,
  indirizzo text,
  citta text,
  tipo text not null check (tipo in ('residenziale', 'commerciale', 'misto')) default 'residenziale',
  attivo boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_proprieta_tenant on proprieta(tenant_id);

-- ============================================================
-- BOT CONFIGURAZIONI (una riga per canale per tenant)
-- ============================================================

create table bot_configurazioni (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  canale text not null check (canale in ('telegram', 'whatsapp')),
  bot_token text,           -- Telegram: bot token | WhatsApp: phone_number_id
  webhook_secret text,      -- segreto per verifica webhook
  api_secret text,          -- WhatsApp: app secret HMAC-SHA256
  admin_chat_id text,       -- Telegram: chat ID admin per notifiche P1
  waba_id text,             -- WhatsApp Business Account ID
  access_token text,        -- WhatsApp: System User access token
  lingua_default text not null default 'it',
  nome_bot text not null default 'TenantBot',
  messaggio_benvenuto text,
  attivo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_id, canale)
);

create index idx_bot_config_tenant on bot_configurazioni(tenant_id);

-- ============================================================
-- UNITA (con tenant_id)
-- ============================================================

create table unita (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  proprieta_id uuid not null references proprieta(id) on delete restrict,
  slug text not null,
  tipo_immobile text not null check (tipo_immobile in ('residenziale', 'commerciale')) default 'residenziale',
  interno text,
  piano int,
  mq numeric,
  locali int,
  bagni int,
  stato text not null check (stato in ('bozza', 'pubblicata', 'occupata', 'archiviata')) default 'bozza',
  descrizione text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create index idx_unita_tenant on unita(tenant_id);
create index idx_unita_proprieta on unita(proprieta_id);

-- ============================================================
-- INQUILINI
-- ============================================================

create table inquilini (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  nome text not null,
  cognome text not null,
  codice_fiscale text,
  telefono_whatsapp text,   -- E.164: +39333xxxxxxx
  email text,
  unita_id uuid references unita(id) on delete set null,
  lingua text not null default 'it' check (lingua in ('it', 'en')),
  attivo boolean not null default true,
  data_ingresso date,
  data_uscita date,
  telegram_user_id text,    -- collegamento bot Telegram
  whatsapp_phone text,      -- E.164 (può differire da telefono_whatsapp)
  created_at timestamptz not null default now(),
  unique (tenant_id, codice_fiscale),
  unique (tenant_id, telegram_user_id),
  unique (tenant_id, telefono_whatsapp)
);

create index idx_inquilini_tenant on inquilini(tenant_id);
create index idx_inquilini_telegram on inquilini(telegram_user_id);
create index idx_inquilini_telefono on inquilini(telefono_whatsapp);

-- ============================================================
-- CONTRATTI
-- ============================================================

create table contratti (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  inquilino_id uuid not null references inquilini(id) on delete cascade,
  unita_id uuid not null references unita(id) on delete restrict,
  pdf_storage_path text,
  data_firma date not null,
  data_inizio date not null,
  data_scadenza date,
  tipo text,                -- es. '4+4', '3+2'
  canone numeric not null,  -- annuale €
  cauzione numeric,
  iban_pagamento text,
  preavviso_mesi int not null default 6,
  attivo boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_contratti_tenant on contratti(tenant_id);
create index idx_contratti_inquilino on contratti(inquilino_id);

create table contratti_embeddings (
  id bigserial primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  contratto_id uuid not null references contratti(id) on delete cascade,
  chunk_text text not null,
  chunk_index int not null,
  embedding vector(1024),
  created_at timestamptz not null default now()
);

create index idx_contratti_emb_tenant on contratti_embeddings(tenant_id);
create index idx_contratti_emb_contratto on contratti_embeddings(contratto_id);
create index idx_contratti_emb_hnsw
  on contratti_embeddings using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- ============================================================
-- KNOWLEDGE BASE NORMATIVA
-- ============================================================

create table kb_documenti (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  proprieta_id uuid references proprieta(id) on delete cascade, -- null = globale per tenant
  tipo text check (tipo in ('regolamento', 'normativa', 'contatti', 'orari', 'altro')),
  titolo text not null,
  contenuto text,           -- testo libero (opzionale se caricato PDF)
  pdf_storage_path text,    -- path in storage bucket 'kb-documenti-pdf'
  attivo boolean not null default true,
  updated_at timestamptz not null default now()
);

create index idx_kb_tenant on kb_documenti(tenant_id);
create index idx_kb_proprieta on kb_documenti(proprieta_id);

create table kb_documenti_embeddings (
  id bigserial primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  documento_id uuid not null references kb_documenti(id) on delete cascade,
  chunk_text text not null,
  chunk_index int not null,
  embedding vector(1024),
  created_at timestamptz not null default now()
);

create index idx_kb_emb_tenant on kb_documenti_embeddings(tenant_id);
create index idx_kb_emb_documento on kb_documenti_embeddings(documento_id);
create index idx_kb_emb_hnsw
  on kb_documenti_embeddings using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- ============================================================
-- TICKET MANUTENZIONE
-- ============================================================

create table ticket_manutenzione (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  numero_ticket serial,
  inquilino_id uuid not null references inquilini(id) on delete cascade,
  unita_id uuid references unita(id) on delete set null,
  priorita text not null check (priorita in ('P1', 'P2', 'P3')) default 'P3',
  stato text not null check (stato in ('aperto', 'in_lavorazione', 'risolto', 'chiuso', 'annullato')) default 'aperto',
  categoria text,
  descrizione text not null,
  foto_paths text[] not null default '{}',
  note_admin text,
  canale_origine text check (canale_origine in ('telegram', 'whatsapp', 'backoffice')) default 'backoffice',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  closed_at timestamptz
);

create index idx_ticket_tenant on ticket_manutenzione(tenant_id);
create index idx_ticket_stato on ticket_manutenzione(tenant_id, stato);
create index idx_ticket_inquilino on ticket_manutenzione(inquilino_id);

-- ============================================================
-- CONVERSAZIONI BOT
-- ============================================================

create table conversazioni (
  id bigserial primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  inquilino_id uuid references inquilini(id) on delete set null,
  canale text not null check (canale in ('telegram', 'whatsapp')) default 'telegram',
  sender_id text,           -- Telegram user_id | WhatsApp phone E.164
  role text not null check (role in ('user', 'assistant', 'system')),
  messaggio text not null,
  intent_classificato text,
  confidence numeric,
  escalated boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_conv_tenant on conversazioni(tenant_id);
create index idx_conv_inquilino on conversazioni(inquilino_id, created_at desc);
create index idx_conv_sender on conversazioni(tenant_id, sender_id, created_at desc);

-- ============================================================
-- AVVISI BROADCAST
-- ============================================================

create table avvisi_broadcast (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  proprieta_id uuid references proprieta(id) on delete cascade, -- null = tutti i tenant
  contenuto_it text not null,
  contenuto_en text,
  canale text not null check (canale in ('telegram', 'whatsapp', 'entrambi')) default 'telegram',
  sent_at timestamptz,
  sent_count int not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index idx_avvisi_tenant on avvisi_broadcast(tenant_id);

-- ============================================================
-- RPC SIMILARITY SEARCH (filtrati per tenant + inquilino/proprieta)
-- ============================================================

create or replace function match_contratto_chunks(
  p_tenant_id uuid,
  p_inquilino_id uuid,
  p_query_embedding vector(1024),
  p_match_count int default 5,
  p_match_threshold float default 0.25
) returns table (chunk_text text, chunk_index int, similarity float) as $$
  select
    ce.chunk_text,
    ce.chunk_index,
    1 - (ce.embedding <=> p_query_embedding) as similarity
  from contratti_embeddings ce
  join contratti c on c.id = ce.contratto_id
  where ce.tenant_id = p_tenant_id
    and c.inquilino_id = p_inquilino_id
    and c.attivo = true
    and 1 - (ce.embedding <=> p_query_embedding) > p_match_threshold
  order by ce.embedding <=> p_query_embedding
  limit p_match_count;
$$ language sql stable security definer;

create or replace function match_kb_documenti(
  p_tenant_id uuid,
  p_proprieta_id uuid,
  p_query_embedding vector(1024),
  p_match_count int default 5,
  p_match_threshold float default 0.25
) returns table (titolo text, contenuto text, similarity float) as $$
  select
    kd.titolo,
    kde.chunk_text as contenuto,
    1 - (kde.embedding <=> p_query_embedding) as similarity
  from kb_documenti_embeddings kde
  join kb_documenti kd on kd.id = kde.documento_id
  where kde.tenant_id = p_tenant_id
    and (kd.proprieta_id = p_proprieta_id or kd.proprieta_id is null)
    and kd.attivo = true
    and 1 - (kde.embedding <=> p_query_embedding) > p_match_threshold
  order by kde.embedding <=> p_query_embedding
  limit p_match_count;
$$ language sql stable security definer;

-- ============================================================
-- TRIGGER updated_at
-- ============================================================

create or replace function trigger_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at_unita before update on unita
  for each row execute function trigger_set_updated_at();
create trigger set_updated_at_kb before update on kb_documenti
  for each row execute function trigger_set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table tenants enable row level security;
alter table tenant_users enable row level security;
alter table proprieta enable row level security;
alter table bot_configurazioni enable row level security;
alter table unita enable row level security;
alter table inquilini enable row level security;
alter table contratti enable row level security;
alter table contratti_embeddings enable row level security;
alter table kb_documenti enable row level security;
alter table kb_documenti_embeddings enable row level security;
alter table ticket_manutenzione enable row level security;
alter table conversazioni enable row level security;
alter table avvisi_broadcast enable row level security;

-- Tenant: ogni utente vede il proprio
create policy "tenants: member read" on tenants for select
  using (id = current_tenant_id());
create policy "tenants: admin update" on tenants for update
  using (id = current_tenant_id() and is_tenant_admin())
  with check (id = current_tenant_id());

-- Tenant users: admin gestisce, member legge
create policy "tenant_users: member read" on tenant_users for select
  using (tenant_id = current_tenant_id());
create policy "tenant_users: admin write" on tenant_users for all
  using (tenant_id = current_tenant_id() and is_tenant_admin())
  with check (tenant_id = current_tenant_id());

-- Proprieta: tenant isolation completo
create policy "proprieta: member read" on proprieta for select
  using (tenant_id = current_tenant_id());
create policy "proprieta: admin write" on proprieta for all
  using (tenant_id = current_tenant_id() and is_tenant_admin())
  with check (tenant_id = current_tenant_id());

-- Bot configurazioni: solo admin
create policy "bot_config: admin all" on bot_configurazioni for all
  using (tenant_id = current_tenant_id() and is_tenant_admin())
  with check (tenant_id = current_tenant_id());

-- Tutte le tabelle bot: member read, admin write
create policy "unita: member read" on unita for select
  using (tenant_id = current_tenant_id());
create policy "unita: admin write" on unita for all
  using (tenant_id = current_tenant_id() and is_tenant_admin())
  with check (tenant_id = current_tenant_id());

create policy "inquilini: member read" on inquilini for select
  using (tenant_id = current_tenant_id());
create policy "inquilini: admin write" on inquilini for all
  using (tenant_id = current_tenant_id() and is_tenant_admin())
  with check (tenant_id = current_tenant_id());

create policy "contratti: member read" on contratti for select
  using (tenant_id = current_tenant_id());
create policy "contratti: admin write" on contratti for all
  using (tenant_id = current_tenant_id() and is_tenant_admin())
  with check (tenant_id = current_tenant_id());

create policy "contratti_emb: member all" on contratti_embeddings for all
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());

create policy "kb: member read" on kb_documenti for select
  using (tenant_id = current_tenant_id());
create policy "kb: admin write" on kb_documenti for all
  using (tenant_id = current_tenant_id() and is_tenant_admin())
  with check (tenant_id = current_tenant_id());

create policy "kb_emb: member all" on kb_documenti_embeddings for all
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());

create policy "ticket: member read" on ticket_manutenzione for select
  using (tenant_id = current_tenant_id());
create policy "ticket: admin write" on ticket_manutenzione for all
  using (tenant_id = current_tenant_id() and is_tenant_admin())
  with check (tenant_id = current_tenant_id());

create policy "conv: member read" on conversazioni for select
  using (tenant_id = current_tenant_id());
create policy "conv: admin write" on conversazioni for all
  using (tenant_id = current_tenant_id() and is_tenant_admin())
  with check (tenant_id = current_tenant_id());

create policy "avvisi: member read" on avvisi_broadcast for select
  using (tenant_id = current_tenant_id());
create policy "avvisi: admin write" on avvisi_broadcast for all
  using (tenant_id = current_tenant_id() and is_tenant_admin())
  with check (tenant_id = current_tenant_id());

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

insert into storage.buckets (id, name, public)
values
  ('contratti-pdf', 'contratti-pdf', false),
  ('kb-documenti-pdf', 'kb-documenti-pdf', false),
  ('ticket-foto', 'ticket-foto', false)
on conflict (id) do nothing;

create policy "contratti-pdf: member access"
  on storage.objects for all to authenticated
  using (bucket_id = 'contratti-pdf' and is_tenant_member())
  with check (bucket_id = 'contratti-pdf' and is_tenant_admin());

create policy "kb-pdf: member access"
  on storage.objects for all to authenticated
  using (bucket_id = 'kb-documenti-pdf' and is_tenant_member())
  with check (bucket_id = 'kb-documenti-pdf' and is_tenant_admin());

create policy "ticket-foto: member access"
  on storage.objects for all to authenticated
  using (bucket_id = 'ticket-foto' and is_tenant_member())
  with check (bucket_id = 'ticket-foto' and is_tenant_admin());
