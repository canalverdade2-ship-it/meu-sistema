## 2026-09-10T23:27:49Z
You are Worker 1 (Frontend Remediation Worker) for the Client Panel and Database Audit mission.
Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_frontend_remediation_1
Project Root: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)
Scope Document: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\PROJECT.md
Original user request: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md under header `## 2026-09-10T23:11:34Z`.
Explorer 1 Report: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_frontend_survey_1\survey_report.md
You MUST read `ORIGINAL_REQUEST.md` and `PROJECT.md` before starting work.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

WRITE OWNERSHIP:
You exclusively own:
- `src/components/client/ClientAssinaturas.tsx`
- `src/components/client/ClientFinanceiro.tsx`
- `src/components/client/ClientProdutos.tsx`
- `src/components/client/ClientServicos.tsx`
- `src/components/client/ClientSuporte.tsx`
- `src/components/client/ClientVouchers.tsx`
- `src/components/client/financeiro/PaymentModal.tsx`
- `src/components/client/ClientProfile.tsx`
- `src/hooks/useClientNotifications.tsx`
- `src/components/admin/FornecedoresModule.tsx`
- `src/components/admin/ServicePackagesModule.tsx`
- `src/components/admin/ConfiguracoesModule.tsx`
- `src/components/admin/AffiliateAdminModule.tsx`

TASK OBJECTIVES:
1. Restore clean UTF-8 for the 7 corrupted client files, eliminating all 253 `\uFFFD` tokens:
   - Notice: Git HEAD contains clean UTF-8 with 0 occurrences of `\uFFFD` for these 7 files. You can restore them from Git HEAD (e.g. `git checkout HEAD -- <files>` or reading git show HEAD:<file> and writing back) since 100% of their working copy diff is just character corruption.
   - Specifically verify that in `src/components/client/ClientFinanceiro.tsx`:
     - `.eq('assunto', 'Solicitação de Liberação Manual de Saque')`
     - `.eq('assunto', 'Solicitação de Saque Abaixo do Mínimo')`
     are clean and exact.
2. Maintain and verify that existing working tree improvements are retained:
   - `ClientEmprestimos.tsx` (navigation fix)
   - `ClientDashboard.tsx` (`onNavigate` tab parameter)
   - `ClassifiedDetailPage.tsx` and `CreateListingWizard.tsx` (`inputMode` syntax)
   - `store/CheckoutPage.tsx` (`useEffect` order)
   - `store/EcommerceHome.tsx` (`onPayload` handler)
3. Fix the 4 admin files with residual `= inputMode="numeric">`:
   - `FornecedoresModule.tsx:792-793`
   - `ServicePackagesModule.tsx:227`
   - `ConfiguracoesModule.tsx:300`
   - `AffiliateAdminModule.tsx:1328`
4. Implement the two client contract improvements flagged by Explorer 1:
   - In `src/components/client/ClientProfile.tsx`, add `useRealtimeSubscription` on table `'cliente_documentos'`.
   - In `src/hooks/useClientNotifications.tsx`, ensure `markAsRead` and `markAllAsRead` are wrapped in `useCallback`, and the context value is wrapped in `useMemo`.
5. Run build and tests:
   - Run `npm run build` to confirm code 0.
   - Run `npm run test:client-security` and `npm run test:client-portals` to confirm code 0.
6. Document all changes and verification command outputs in your handoff report:
   `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_frontend_remediation_1\handoff.md`.
Send a message to your parent orchestrator with your results when complete.
