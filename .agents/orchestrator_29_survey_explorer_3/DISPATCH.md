# Dispatch: Survey Explorer 3 (Database Schema, RPCs, RLS & Connection Graph)

## Working Directory
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\orchestrator_29_survey_explorer_3`

## Authoritative Reference
Read `ORIGINAL_REQUEST.md` (specifically section `## 2026-09-16T11:11:22Z`):
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\ORIGINAL_REQUEST.md`

## Objective
Survey and map the complete PostgreSQL database schema, migrations, tables, RPCs, triggers, and RLS policies, and establish the structural edges for the Connection Graph (Requirement R1).

## Scope
1. Catalog all database tables and views in `supabase/migrations/` (primary keys, foreign keys, constraints).
2. Catalog all Remote Procedure Calls (RPCs) and stored procedures (arguments, return types, `SECURITY DEFINER` vs `INVOKER`, row-locking `FOR UPDATE`).
3. Catalog all Triggers and functions (audit, balance checks, status transitions, timestamps).
4. Catalog Row Level Security (RLS) policies across all tables for `anon`, `authenticated`, and `service_role`.
5. Identify data access patterns in frontend/backend: which components execute direct table queries (`supabase.from(...)`) vs RPC calls (`supabase.rpc(...)`).
6. Identify potential N+1 query patterns, missing foreign key indexes, and referential integrity constraints.
7. Outline the explicit Connection Graph format: `[Source Element / UI] -> [Function / Hook] -> [API / RPC / Table] -> [Controller / Backend] -> [Database Entity]`.
8. Output structured markdown tables ready to be integrated into `PROJECT.md` and the Connection Graph.

## Output
Write `analysis.md` and a summary `handoff.md` in your working directory:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\orchestrator_29_survey_explorer_3`

## 2026-09-16T11:13:47Z
You are orchestrator_29_survey_explorer_3.
Your working directory is:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\orchestrator_29_survey_explorer_3

Read your task instructions in:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\orchestrator_29_survey_explorer_3\DISPATCH.md
Also read ORIGINAL_REQUEST.md:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\ORIGINAL_REQUEST.md

Perform a deep technical survey of the database schema, RPCs, RLS, and initial connection graph:
1. Catalog all database tables and views in supabase/migrations/ (primary keys, foreign keys, constraints).
2. Catalog all Remote Procedure Calls (RPCs) and stored procedures (arguments, return types, SECURITY DEFINER vs INVOKER, row-locking FOR UPDATE).
3. Catalog all Triggers and functions (audit, balance checks, status transitions, timestamps).
4. Catalog Row Level Security (RLS) policies across all tables for anon, authenticated, and service_role.
5. Identify data access patterns in frontend/backend: which components execute direct table queries (supabase.from(...)) vs RPC calls (supabase.rpc(...)).
6. Identify potential N+1 query patterns, missing foreign key indexes, and referential integrity constraints.
7. Outline the explicit Connection Graph format: [Source Element / UI] -> [Function / Hook] -> [API / RPC / Table] -> [Controller / Backend] -> [Database Entity].
8. Write your exhaustive findings in analysis.md and summarize in handoff.md in your working directory.
When done, notify me via send_message with a concise summary and link to handoff.md.
