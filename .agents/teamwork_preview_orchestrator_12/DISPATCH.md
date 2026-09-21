# Dispatch Instructions

## 2026-08-27T20:07:44Z

### Mission Summary:
Execute a system-wide comprehensive audit and remediation of real-time functionality (Supabase Realtime subscriptions) across the entire platform.
Ensure 100% of the system correctly updates in real-time without requiring manual page reloads or presenting stale data.

Key Deliverables & Acceptance Criteria:
1. **R1. Comprehensive System-wide Audit**: 100% full-scale codebase sweep of all files/modules (Admin, Client, Public, Affiliates, etc.) displaying dynamic lists/tables/statuses. Identify components where data mutations occur but UI updates rely on manual reloads.
2. **R2. Realtime Remediation**: Implement or fix `useRealtimeSubscription` (or equivalent) in all identified modules. Ensure channel subscriptions match table names and filters, and `onChange` callbacks correctly invalidate/reload local state instantly. Replace ad-hoc polling/intervals where appropriate.
3. **R3. Automated Testing Verification**: Develop and execute local automated test scripts (e.g. `test_realtime.js` with Puppeteer) programmatically proving real-time updates work without manual refresh, with no channel/subscription errors in console.
4. **Audit Report**: Generate `realtime_audit_report.md` detailing all files/modules audited and specific fixes applied.
5. **Quality & Integrity**: Project builds successfully (`npm run build`), typechecks clean, and unit/integration tests pass (`npx vitest run src/tests`).
