## 2026-08-27T18:40:13Z
You are the Worker for Milestone 5 (Admin Monitor UI & Pause Dispatch Component - R5).
Working Directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_m5
Scope Document: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\PROJECT.md
Survey Analysis: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\survey_explorer_3\analysis.md
User Request: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md (see 2026-08-27T18:30:11Z)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

File Ownership:
You own `src/components/admin/WhatsAppHealthMonitor.tsx`, `src/pages/AdminPanel.tsx` (topbar integration), `src/components/admin/super-domains/governanca/GovernancaInfraView.tsx` (WhatsApp tab integration), and test file `src/tests/whatsapp-health-monitor-ui.test.tsx`.

Tasks:
1. Implement `src/components/admin/WhatsAppHealthMonitor.tsx` supporting:
   - Variants: `'card'` (full metric dashboard with status badges, ping latency, last checked timestamp, queue count, manual refresh button, Pause Dispatch switch), `'compact'` (pill badge with online/offline dot and latency), and `'header-popover'` (compact topbar trigger with floating popover).
   - Display real-time Evolution API connection status (`connected`, `connecting`, `disconnected`, `error`) using `useWhatsAppHealth` hook and GSA OS design system tokens (`StatusBadge`, Lucide icons, Tailwind styling).
   - "Pause Dispatch" toggle switch: pauses/resumes dispatch queue in `whatsappHealthService`, holding messages in local queue with badge telemetry.
   - Manual refresh trigger with loading spinner and toast notification.
2. Integrate `WhatsAppHealthMonitor` into:
   - `src/pages/AdminPanel.tsx`: Topbar header alongside `SystemStatusIndicator` (compact/popover mode).
   - `src/components/admin/super-domains/governanca/GovernancaInfraView.tsx`: Top of the WhatsApp / Evolution API tab (`whatsapp`) above `WhatsAppQRCodeManager`.
3. Create unit/component test `src/tests/whatsapp-health-monitor-ui.test.tsx` verifying:
   - Rendering connected, connecting, disconnected, and error states.
   - Pause Dispatch toggle interaction updating pause state.
   - Manual refresh button triggering health check.
4. Run tests with `npx vitest run src/tests/whatsapp-health-monitor-ui.test.tsx` and verify `npm run typecheck:strict`.
5. Document all changes in `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_m5\handoff.md` and report back.
