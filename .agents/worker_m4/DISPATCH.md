## 2026-08-27T18:35:33Z
You are the Worker for Milestone 4 (M4: Keep-Alive Routine & WebSocket Health Maintenance - R4).
Working Directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_m4
Scope Document: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\PROJECT.md
Survey Analysis: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\survey_explorer_3\analysis.md
User Request: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md (see 2026-08-27T18:30:11Z)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

File Ownership:
You own `src/lib/whatsappHealthService.ts`, `src/hooks/useWhatsAppHealth.ts`, and unit test `src/tests/whatsapp-health-service.test.ts`.

Tasks:
1. Implement `src/lib/whatsappHealthService.ts`:
   - Keep-Alive periodic check of Evolution API (`GET /instance/connectionState/GSA_WhatsApp` port 8080 with apikey `gsa_hub_evolution_token_2026`, and fallback via Edge function `vps-api` `action: 'whatsapp-status'`).
   - Adaptive polling interval: 30s when tab is active / in foreground; 120s when `document.hidden === true` (Page Visibility API); immediate probe on tab focus (`visibilitychange`) and `window.online`.
   - Telemetry tracking: `status` ('connected' | 'connecting' | 'disconnected' | 'error'), `rawState`, `lastChecked`, `latencyMs`, `consecutiveErrors` with exponential backoff.
   - Subscriber listener pattern (`subscribe(cb)`) for real-time reactivity in UI components.
   - Local queue and Pause Dispatch state management: `setPaused(boolean)`, `isPaused(): boolean`, queue tracking with `localStorage` persistence (`gsa_whatsapp_dispatch_paused`, `gsa_whatsapp_pending_queue`).
2. Implement `src/hooks/useWhatsAppHealth.ts`:
   - React hook consuming `whatsappHealthService`, providing reactive state (`status`, `rawState`, `lastChecked`, `latencyMs`, `isPaused`, `queuedCount`) and control functions (`checkNow()`, `setPaused()`, `togglePause()`).
3. Create unit tests in `src/tests/whatsapp-health-service.test.ts` validating:
   - Health status resolution (connected vs disconnected vs error).
   - Visibility change listener interval adaptation.
   - Subscriber notifications on state change.
   - Pause dispatch flag toggle and localStorage persistence.
4. Run tests with `npx vitest run src/tests/whatsapp-health-service.test.ts` and verify strict type checking `npm run typecheck:strict`.
5. Document all changes and test outputs in `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_m4\handoff.md` and report back.
