# Project Plan: WhatsApp Self-Service Benefit Redemption Protocol with Gemini AI NLU

## 1. Survey & Architecture Mapping
- Launch 3 parallel Explorers:
  1. `teamwork_preview_explorer_survey_1`: Focus on `server_webhook_vps_live.cjs`, `server_webhook.cjs`, existing WhatsApp webhook handling, message format, phone parsing, and state flow.
  2. `teamwork_preview_explorer_survey_2`: Focus on Gemini AI integration in the codebase (how `GEMINI_API_KEY` is used, models, prompt engineering, structured extraction, JSON response handling).
  3. `teamwork_preview_explorer_survey_3`: Focus on Supabase database schema (`parceiros_resgates`), existing migrations in `supabase/migrations/`, notifications system (`5511971858372`, `5511920857756`), and existing test suite/runners.

## 2. Global Architecture & PROJECT.md
- Synthesize explorer reports.
- Define Architecture, Feature Inventory (R1, R2, R3 mapped), Interface Contracts, Code Layout, and Milestones.

## 3. Dual Track Execution
- **E2E Testing Track**:
  - Spawn `teamwork_preview_test_writer` / testing worker to build automated E2E test harness covering Tiers 1-4 (feature coverage, boundary cases, state transitions, full conversational flow simulation).
  - Produce `TEST_INFRA.md` and `TEST_READY.md`.
- **Implementation Track**:
  - **Milestone 1: Database Migration & Schema Alignment**: Create idempotent SQL migration adding `data_cancelamento` to `parceiros_resgates`, test DB helpers.
  - **Milestone 2: Gemini NLU Extraction & State Machine**: Build state machine (`IDENTIFIED`, `AWAITING_ACTION`, `AWAITING_FIELD`, `AWAITING_NEW_VALUE`, `AWAITING_CANCEL_CONFIRM`), Gemini intent/entity extractor with fallback, protocol recognition.
  - **Milestone 3: Database Actions, Admin Notifications & Phone Fix**: Update Supabase records, send WhatsApp notifications to admin `5511971858372`, fix typo to `5511920857756`.

## 4. Verification & Audit Loop
- Reviewers and Challengers for each milestone.
- Forensic Auditor integrity checks.
- 100% E2E test pass + Adversarial Hardening.
