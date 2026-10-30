# TenantBot

**AI-powered chatbot SaaS for property managers.** Tenants get instant answers about their lease contracts, building regulations, and maintenance requests — directly on Telegram or WhatsApp.

> Currently targeted at the Italian residential rental market, with multi-language support (Italian/English) for tenants.

---

## Overview

TenantBot is a multi-tenant SaaS platform that lets property managers deploy a branded AI assistant for their tenants in minutes. Instead of fielding repetitive calls about rent amounts, contract clauses, or broken boilers, managers configure a bot once and let it handle the majority of day-to-day questions automatically.

**For tenants:**
- Ask anything about their lease: monthly rent, deposit, termination notice, IBAN
- Query building regulations and condo rules
- Submit maintenance tickets (with urgency detection)
- Everything from Telegram or WhatsApp — no app download needed

**For property managers:**
- Backoffice dashboard to manage properties, units, tenants, and contracts
- Upload PDF contracts → automatically chunked and embedded for semantic search
- Build a knowledge base with building regulations, local rules, and FAQs
- Receive escalation notifications for urgent tickets or requests to speak to a human
- Full conversation history and ticket tracking

---

## Architecture

This is a **Turborepo monorepo** using pnpm workspaces.

```
tenantbot/
├── apps/
│   ├── landing/        # Marketing site (tenantbot.it)
│   ├── admin/          # Backoffice SPA (app.tenantbot.it)
│   └── api/            # Vercel serverless API (api.tenantbot.it)
├── packages/
│   ├── core/           # Bot engine, AI logic, channel adapters
│   ├── db/             # TypeScript types, DB migrations
│   └── ui/             # Shared React components
```

All three apps deploy independently to **Vercel**.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router 7, Tailwind CSS 4, Vite 6 |
| Backend | Vercel Serverless Functions (Node.js) |
| Database | Supabase (PostgreSQL + pgvector) |
| AI – Chat | Anthropic Claude (intent classification + RAG answers) |
| AI – Embeddings | Voyage AI (`voyage-3`) |
| Channels | Telegram Bot API, WhatsApp Cloud API (Meta) |
| Payments | Stripe (subscriptions) |
| Email | Resend |
| Build | Turborepo, pnpm |

---

## How It Works

### 1. Tenant onboarding

A tenant connects their Telegram or WhatsApp account to their profile via one of three methods:

- **Deep link** — Admin copies a unique `/start inq_<uuid>` link from the backoffice; tenant clicks it, bot links automatically.
- **Self-registration** — Tenant types `Surname UnitNumber` (e.g. `Rossi 2A`); bot matches against the database.
- **Contact sharing** — Legacy fallback for WhatsApp; tenant shares their phone contact.

### 2. Message handling (`packages/core/src/engine/bot-engine.ts`)

Every incoming message runs through a pipeline:

```
Incoming message
    │
    ├─ Deep link? ──────────────────────────► Link account → welcome
    │
    ├─ Known tenant?  No ──────────────────► Self-registration flow
    │
    └─ Known tenant? Yes
           │
           ├─ Slash command / keyboard button ──► Dedicated handler
           │
           ├─ Pending maintenance state ─────────► Confirm & open ticket
           │
           └─ Free text
                  │
                  ├─ Structured pattern match ──► Direct DB lookup
                  │   (rent, expiry, deposit…)
                  │
                  └─ Claude intent classification
                         │
                         ├─ contract_question_rag ─► RAG on contract chunks
                         ├─ law_question ──────────► RAG on KB documents
                         ├─ maintenance_ticket ────► Open ticket flow
                         └─ escalation ────────────► Email admin + notify
```

### 3. RAG pipeline

Contract PDFs and knowledge-base documents are:
1. Uploaded in the backoffice and stored in Supabase Storage
2. Split into overlapping text chunks (`packages/core/src/ingest/`)
3. Embedded with **Voyage AI** and stored in `contratto_embeddings` / `kb_documento_embeddings` (pgvector)

At query time, the bot:
1. Embeds the tenant's question with Voyage AI
2. Runs `match_contratto_chunks` and `match_kb_documenti` RPC functions (cosine similarity, threshold 0.25)
3. Sends the retrieved context + question to **Claude** for a grounded answer

Contract clauses always take precedence over generic KB documents.

### 4. Maintenance tickets

- Tenant describes the problem in free text
- Bot looks up KB for responsibility info (landlord vs. tenant) and shows it upfront
- Tenant confirms → ticket inserted with priority (`P1` for "URGENTE", `P2` otherwise)
- P1 tickets trigger an immediate Telegram notification to the admin's `admin_chat_id`

---

## API Routes (`apps/api/`)

| Route | Description |
|---|---|
| `POST /api/webhook/telegram/[tenantId]` | Telegram webhook handler |
| `POST /api/webhook/whatsapp/[tenantId]` | WhatsApp Cloud API webhook + HMAC verification |
| `GET  /api/webhook/whatsapp/[tenantId]` | WhatsApp webhook verification challenge |
| `POST /api/setup/telegram` | Register Telegram bot token + set webhook |
| `POST /api/setup/whatsapp` | Register WhatsApp credentials |
| `POST /api/ingest/contratto` | Ingest / re-embed a contract PDF |
| `POST /api/ingest/kb-documento` | Ingest / re-embed a KB document |
| `GET  /api/admin/bot-diagnostic` | Bot health check (webhook status, config) |
| `POST /api/admin/[action]` | Generic admin actions (broadcast, etc.) |
| `POST /api/stripe/webhook` | Stripe subscription lifecycle events |

---

## Database Schema

Key tables (Supabase / PostgreSQL):

| Table | Description |
|---|---|
| `tenants` | SaaS accounts — one per property manager |
| `tenant_users` | Users belonging to a tenant (admin / member) |
| `proprieta` | Properties (residential, commercial, mixed) |
| `unita` | Individual units within a property |
| `inquilini` | Tenants (linked to a unit + Telegram/WhatsApp) |
| `contratti` | Lease contracts |
| `contratto_embeddings` | pgvector embeddings for contract chunks |
| `kb_documenti` | Knowledge base documents |
| `kb_documento_embeddings` | pgvector embeddings for KB chunks |
| `ticket_manutenzione` | Maintenance tickets (P1/P2/P3) |
| `conversazioni` | Full conversation log per tenant |
| `avisi_broadcast` | Broadcast messages sent to all tenants |
| `bot_configurazioni` | Per-tenant bot settings (token, webhook, channel) |

Migrations are in `packages/db/migrations/`.

---

## Billing Plans

| Plan | Properties | Units | Channels |
|---|---|---|---|
| **Starter** | 1 | 30 | Telegram only |
| **Pro** | 5 | 150 | Telegram + WhatsApp |
| **Enterprise** | Unlimited | Unlimited | Telegram + WhatsApp |

Plans are enforced in both the backoffice and the API. Billing is handled by Stripe subscriptions with a trial period.

---

## Local Development

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- A [Supabase](https://supabase.com) project (PostgreSQL + pgvector)
- An [Anthropic](https://console.anthropic.com) API key
- A [Voyage AI](https://www.voyageai.com) API key

### Setup

```bash
git clone https://github.com/frabzz89/tenantbot.git
cd tenantbot
pnpm install
cp .env.example .env
# Fill in your credentials in .env
```

### Run all apps in parallel

```bash
pnpm dev
```

This starts:
- Landing page at `http://localhost:5173`
- Admin backoffice at `http://localhost:5174`
- API at `http://localhost:3000` (via `vercel dev`)

### Build

```bash
pnpm build
```

### Type-check

```bash
pnpm typecheck
```

---

## Environment Variables

See [`.env.example`](.env.example) for a full list. Key variables:

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Supabase keys for the React apps |
| `ANTHROPIC_API_KEY` | Claude API key |
| `VOYAGE_API_KEY` | Voyage AI embeddings key |
| `RESEND_API_KEY` | Transactional email via Resend |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe billing |
| `WHATSAPP_APP_SECRET` | Meta App secret for webhook HMAC verification |
| `INGEST_SECRET` | Shared secret between admin SPA and ingest API endpoints |
| `VITE_API_URL` / `VITE_ADMIN_URL` | Public URLs of the API and admin apps |

---

## Deployment

The three apps deploy as independent Vercel projects:

| Project | App | Domain |
|---|---|---|
| `tenantbot-landing` | `apps/landing` | `tenantbot.it` |
| `tenantbot-admin` | `apps/admin` | `app.tenantbot.it` |
| `tenantbot-api` | `apps/api` | `api.tenantbot.it` |

Each has a `vercel.json` at its root. Set the environment variables in each Vercel project's settings.

---

## License

Private — all rights reserved. Contact [francescobuzzi89@gmail.com](mailto:francescobuzzi89@gmail.com) for licensing inquiries.
