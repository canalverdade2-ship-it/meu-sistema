## 2026-08-26T14:40:36Z
You are worker_m5_client_portal_gen2.
Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_m5_client_portal_gen2
Workspace root: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)

MANDATORY FIRST STEP: Read ORIGINAL_REQUEST.md (specifically timestamp 2026-08-26T13:52:52Z) and PROJECT.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Scope: Milestone 5 — Client Portal Realtime (R12 — 28+ Components).
Exclusive File Ownership:
`src/components/client/`:
1. `ClientProfile.tsx`
2. `ClientAffiliatePanel.tsx`
3. `ClientAreaVIP.tsx`
4. `ClientAssinaturas.tsx`
5. `ClientFinanceiro.tsx`
6. `ClientFidelidade.tsx`
7. `ClientIndiqueGanhe.tsx`
8. `ClientMeuCredito.tsx`
9. `ClientOrcamentos.tsx`
10. `ClientPontos.tsx`
11. `ClientProdutos.tsx`
12. `ClientServicos.tsx`
13. `ClientSuporte.tsx`
14. `ClientTransferencias.tsx`
15. `ClientVouchers.tsx`
16. `StoreHub.tsx`
17. `store/EcommerceHeader.tsx`
18. `store/EcommerceHome.tsx`
19. `store/CheckoutModal.tsx`
20. `store/CheckoutPage.tsx`
21. `store/PurchasesPage.tsx`
22. `financeiro/PaymentModal.tsx`
23. `financeiro/SaquesList.tsx`
24. `marketplace/classifieds/EditClassifiedListingPage.tsx`
25. `marketplace/travel/TravelProposalsPage.tsx`
26. `marketplace/travel/TravelReservationPage.tsx`
27. `marketplace/travel/TravelCancellationsPage.tsx`
28. `marketplace/travel/TravelQuoteRequestPage.tsx`
29. `common/SupportConversationModal.tsx`
30. `hooks/usePublicRegistrationSettings.ts`

Implementation Requirements:
- Use `useRealtimeSubscription` / `useRealtime` from `src/hooks/useRealtime.ts` across all listed client components.
- Apply row-level filters where appropriate (e.g. `cliente_id=eq.${clientId}`).
- Special focus:
  - `ClientVouchers.tsx`: live voucher updates when admin grants/updates vouchers (<3s).
  - `EcommerceHeader.tsx`: real-time cart item count sync across tabs and devices via `loja_carrinhos` or cart events.
  - `ClientSuporte.tsx` & `SupportConversationModal.tsx`: live support chat updates (<3s).
  - `ClientOrcamentos.tsx` & `ClientMeuCredito.tsx`: live status updates for budgets and credit loans.
  - `usePublicRegistrationSettings.ts`: live updates on `system_settings`.
- Verification: `npx vitest run src/tests` and `npm run build` must succeed with exit code 0.
- Write `handoff.md` and report back.
