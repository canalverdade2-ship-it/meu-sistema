# Progress — teamwork_preview_worker_infra_seed

Last visited: 2026-09-16T17:26:00Z
Status: In Progress (Active Implementation)

## Tasks
- [x] Initial survey and reference analysis (report.md, handoff.md, ORIGINAL_REQUEST.md)
- [x] Setup BRIEFING.md and progress.md
- [x] Database schema & constraints analysis across 409 migrations
- [ ] Step 1: Create canonical `supabase/seed.sql` with deterministic data for all 6 personas + partner and related entities
- [ ] Step 2: Implement seed applicator & auth verification runner (`scripts/apply-seed.ts`)
- [ ] Step 3: Implement local Edge Functions HTTP runner (`scripts/serve-local-functions.ts`)
- [ ] Step 4: Implement external mocks & sandboxes (`scripts/external-mocks.ts`)
- [ ] Step 5: Verify webhook `server_webhook.cjs` in isolated mode
- [ ] Step 6: Create comprehensive verification harness (`scripts/verify-r1-infra.ts`) and run full suite
- [ ] Step 7: Update BRIEFING.md, write handoff.md, send message to parent
