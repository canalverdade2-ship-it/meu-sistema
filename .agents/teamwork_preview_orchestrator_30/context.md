# Context: Deep End-to-End Technical Audit (Final Strict Draft)

## Project Overview
This project is an exhaustive, deep end-to-end technical audit of the entire GSA system (Remix, React, Vite, Supabase PostgreSQL, Edge Functions, VPS / N8N / Evolution API / Cloudflare).

## Integrity Constraints
- Benchmark integrity mode: absolute veracity, no fabricated test results or coverage numbers.
- Unpresumed coverage: every item marked "VALIDADO" must have dynamic runtime test evidence (asserts, logs, execution outputs).
- "NÃO TESTADO" requires concrete technical justification.
- Bug remediation must follow strict sequence: Identify -> Reproduce -> Automated Test -> Root Cause -> Fix -> Retest -> Regression check.
- Mandatory Segunda Varredura (second sweep) after initial fixes to eliminate regressions and orphan code.
- Baseline must be recorded BEFORE any modifications.

## User Request Reference
Consult `ORIGINAL_REQUEST.md` (specifically `## 2026-09-16T11:15:31Z`) for full verbatim requirements and acceptance criteria.
