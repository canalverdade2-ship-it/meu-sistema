# DISPATCH

## 2026-08-26T23:24:25Z

Execute a deep and corrective mass audit of the entire GSA HUB system, validating every UI component, backend function, and database table, focusing intensively on payment logics, affiliate commissions, and partner redemptions as specified in ORIGINAL_REQUEST.md.

Key Requirements:
1. R1: Front-end Audit and Correction (React components, buttons, modals, forms, TypeScript functions, zero broken buttons/syntax errors).
2. R2: Absolute Database Integrity (PostgreSQL schema, columns, system_settings, RPCs on production VPS 147.15.43.141 port 5433).
3. R3: Business Logic Stress Testing (payments, affiliate commissions, partner redemptions).
4. R4: Controlled Server Access via SSH (opc@147.15.43.141 with key C:\Users\Adriano Farias\Downloads\CLOUD\ssh-key-2026-07-30.key).

Acceptance Criteria:
- Typecheck (tsc / npm run typecheck) and Build (npm run build) pass cleanly.
- Vitest tests (npx vitest run src/tests) pass 100%, with automated tests for partner redemption and commission happy & edge cases.
- Automated scripts validate PostgreSQL schema against TypeScript types.
