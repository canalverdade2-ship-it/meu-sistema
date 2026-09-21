# Dispatch: Survey Explorer 2 (Backend APIs, Services, Webhooks & Integrations)

## Working Directory
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\orchestrator_29_survey_explorer_2`

## Authoritative Reference
Read `ORIGINAL_REQUEST.md` (specifically section `## 2026-09-16T11:11:22Z`):
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\ORIGINAL_REQUEST.md`

## Objective
Survey and map the complete backend, API, webhook, and external integration surface of the system to serve as the foundation for the Test Inventory, Connection Graph, and Traceability Matrix (Requirement R1).

## Scope
1. Catalog all Edge Functions in `supabase/functions/` (parameters, auth checks, external calls, return types).
2. Catalog all server webhooks and backend scripts (`server_webhook*.cjs`, Deno scripts, VPS endpoints, background jobs).
3. Enumerate all external integrations: Evolution API (WhatsApp), n8n webhooks, Supabase Auth/Storage/Realtime, external payment/services.
4. Catalog all frontend client services and utilities (`src/services/`, `src/utils/`, `src/lib/`, `src/hooks/`) that interact with APIs or external endpoints.
5. Detail authentication/authorization mechanisms (Bearer tokens, role/actor verification, header requirements).
6. Document error handling, retry policies, rate limiting, and idempotency mechanisms across API endpoints and webhooks.
7. Document how local test harnesses can mock or execute these endpoints without external dependencies.
8. Output structured markdown tables ready to be integrated into `PROJECT.md` and the Test Inventory.

## Output
Write `analysis.md` and a summary `handoff.md` in your working directory:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\orchestrator_29_survey_explorer_2`

## 2026-09-16T11:13:45Z
Perform a deep technical survey of the backend, APIs, webhooks, and integrations:
1. Catalog all Edge Functions in supabase/functions/ (parameters, auth checks, external calls, return types).
2. Catalog all server webhooks and backend scripts (server_webhook*.cjs, Deno scripts, VPS endpoints, background jobs).
3. Enumerate all external integrations: Evolution API (WhatsApp), n8n webhooks, Supabase Auth/Storage/Realtime, external payment/services.
4. Catalog all frontend client services and utilities (src/services/, src/utils/, src/lib/, src/hooks/) that interact with APIs or external endpoints.
5. Detail authentication/authorization mechanisms (Bearer tokens, role/actor verification, header requirements).
6. Document error handling, retry policies, rate limiting, and idempotency mechanisms across API endpoints and webhooks.
7. Document how local test harnesses can mock or execute these endpoints without external dependencies.
8. Write your exhaustive findings in analysis.md and summarize in handoff.md in your working directory.
When done, notify me via send_message with a concise summary and link to handoff.md.
