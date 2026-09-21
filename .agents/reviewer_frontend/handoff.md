# Realtime Frontend Review Report (R1, R2, R3)

**Verdict**: **APPROVE**  
**Reviewer Role**: Reviewer 1 (Frontend Realtime: R1, R2, R3) & Adversarial Critic  
**Date**: 2026-08-28T14:40:00Z  

---

## 1. Observation

Direct code and test observations for all deliverables under scope:

### A. R1 Canonical Hook Infrastructure (`src/hooks/useRealtime.ts` & `src/hooks/useRealtimeTable.ts`)
- **Stale Closures & Index Alignment**:
  - In `src/hooks/useRealtime.ts`, lines 67-70: `callbacksRef.current` is directly synced on every render pass with `incomingConfigs.map(...)`.
  - In lines 119-122: Enabled configs are mapped along with their original array indices:
    ```typescript
    const enabledConfigsWithIdx = rawConfigs
      .map((config, originalIdx) => ({ config, originalIdx }))
      .filter(({ config }) => config.enabled !== false);
    ```
  - In lines 165-195: Callback invocations inside `postgres_changes` event handler resolve `callbacksRef.current[originalIdx]`, guaranteeing that disabling preceding configs does NOT shift callback targets or cause index desynchronization.
  - In debounced execution (lines 180-192): Timers are keyed per `originalIdx` (`debounceTimersRef.current[originalIdx]`), and on timeout execution, the latest `callbacksRef.current[originalIdx]?.onChange` is referenced, completely eliminating stale closure issues.
- **Unmount & Reconnection Lifecycle**:
  - Lines 224-240: Cleanup function unconditionally sets `isMountedRef.current = false`, clears all pending debounce timeouts, and removes the channel via `supabase.removeChannel(chan)`.
  - Line 208: Superseded channel subscriptions during fast remounts or React StrictMode are safely guarded (`if (!isMountedRef.current || channelRef.current !== channel) return;`).
- **Backward Compatibility**:
  - `src/hooks/useRealtimeTable.ts` operates as a shim converting legacy `(tables, onRefresh, prefix)` calls into canonical `useRealtimeSubscription` configurations with a default 300ms debounce.

### B. R2 Admin Modules Review (8 Modules)
1. `src/components/admin/ProdutosModule.tsx`:
   - Subscribes via canonical `useRealtimeSubscription` (lines 313-330) to `produtos`, `loja_categorias`, `loja_estoque_historico`, `produto_fornecedor_config`, `produto_variantes`, `produto_variacao_grupos`, `produto_variacao_opcoes`.
   - Includes 300ms debounce and active item cache update in `onPayload`.
2. `src/components/admin/OrdensAssinaturaModule.tsx`:
   - Subscribes (lines 124-130) to `ordens_assinatura`, `assinaturas`, `faturas`, `orcamentos`, `clientes` with 300ms debounce.
3. `src/components/admin/OrdensCompraModule.tsx`:
   - Subscribes (lines 143-151) to `ordens_compra`, `produtos`, `faturas`, `cupons_loja`, `orcamentos`, `clientes`, `pagamentos` with 300ms debounce.
4. `src/components/admin/AdvertisingAdminModule.tsx`:
   - Subscribes (lines 142-149) to `gsa_ad_requests`, `gsa_ad_proposals`, `gsa_ad_campaigns`, `gsa_ad_creatives`, `gsa_ad_payments`, `gsa_ad_placements` with 300ms debounce.
5. `src/components/admin/ServicePackagesModule.tsx`:
   - Subscribes (lines 80-83) to `servicos`, `servicos_pacotes` with 300ms debounce.
6. `src/components/admin/super-domains/pessoas/TrabalheConoscoSection.tsx`:
   - Subscribes (lines 91-93) to `gsa_careers_applications` with 500ms debounce and silent refresh parameter.
7. `src/components/admin/CareersAdminModule.tsx`:
   - Subscribes (lines 127-129) to `gsa_careers_applications` with 500ms debounce.
8. `src/components/admin/super-domains/pessoas/PessoasSuperDomain.tsx`:
   - Subscribes (lines 121-128) to `prestadores`, `prestador_saques`, `saques`, `fornecedores`, `gsa_afiliados`, `gsa_careers_applications`.

### C. R3 Admin & Client Modules Review (7 Modules)
1. `src/components/admin/ConfiguracoesModule.tsx`:
   - Subscribes (lines 49-55) to `system_settings` with 300ms debounce.
2. `src/components/admin/super-domains/operacoes/OrcamentosWorkstation.tsx`:
   - Subscribes (lines 150-156) to `orcamentos`, `ordens_servico` with 400ms debounce and `[statusFilter, search]` deps.
3. `src/hooks/useClientNotifications.tsx`:
   - Scoped channels with `filter: 'cliente_id=eq.' + clientId` and dedicated notification & security channels.
   - Guaranteed cleanup of all 3 channels in unmount callback (lines 382-384).
4. `src/pages/Afiliado/AfiliadoDashboard.tsx`:
   - Subscribes (lines 393-437) to `gsa_afiliados`, `gsa_afiliado_links`, `gsa_afiliado_comissoes`, `gsa_afiliado_saques`, `gsa_afiliado_programas`, `saques`.
   - Guarded by row-level filters (`filter: affiliateId ? 'id=eq.' + affiliateId : undefined`) and `enabled: Boolean(affiliateId)`.
5. `src/components/client/store/PurchasesPage.tsx`:
   - Subscribes (lines 308-347) to `orcamentos`, `ordens_compra`, `ordens_assinatura`, `loja_pedido_itens`, `loja_pedidos`.
   - Filtered with `cliente_id=eq.${clientId}` and `enabled: Boolean(clientId)`.
6. `src/components/client/store/CouponsPage.tsx`:
   - Subscribes (lines 170-186) to `cupons_loja` (global) and `cupons_ativados` (scoped with `cliente_id=eq.${clientId}` and `enabled: Boolean(clientId)`).
7. `src/components/admin/super-domains/pessoas/PrestadorDetailDrawer.tsx`:
   - Subscribes (lines 64-82) to `prestadores` and `prestador_demandas` with `filter: prestador?.id ? 'prestador_id=eq.' + prestador.id : undefined` and dynamic activation guard `enabled: Boolean(isOpen && prestador?.id)`.

### D. Verification Command Outputs
- `npx vitest run src/tests/realtime-hook.test.ts`: **15/15 Passed** (65ms).
- `npx tsx scripts/check-realtime-audit.ts`: **Health Score 100/100, 0 Legacy Hook Usages in production, 0 Leaks, 0 Direct Channels Without Cleanup**.
- `npm run build`: **Exited 0** (3884 modules transformed, built cleanly in 50.37s).

---

## 2. Logic Chain

1. **Stale Closures & Index Alignment**:
   - *Observation*: `useRealtimeSubscription` uses `callbacksRef.current` updated every render, paired with `originalIdx` mapping in `enabledConfigsWithIdx`.
   - *Inference*: When conditional items are disabled (e.g. `enabled: false`), the callback array indices and the change event dispatcher remain in 1:1 synchronization. When debounce timers expire, they execute the newest closure stored in `callbacksRef.current[originalIdx]`.
   - *Conclusion*: R1-01 and R1-02 requirements are fully satisfied with zero stale closure hazard.

2. **React Hook Integrity & Rules**:
   - *Observation*: All 15 files invoke `useRealtimeSubscription` / `useRealtime` strictly at the component root level, before any early returns, conditionals, loops, or nested functions.
   - *Inference*: The React Hook call order is invariant across all render cycles.
   - *Conclusion*: Adheres 100% to the Rules of Hooks.

3. **Ghost Table Elimination & Database Publication**:
   - *Observation*: Migration `20260826140000_enable_realtime_full_replica_identity_105_tables.sql` configures `REPLICA IDENTITY FULL` and adds 105 actual tables to the `supabase_realtime` publication.
   - *Inference*: All table names used in R1, R2, and R3 modules (`produtos`, `loja_categorias`, `ordens_assinatura`, `gsa_careers_applications`, `gsa_afiliados`, `cupons_ativados`, etc.) are concrete PostgreSQL database tables.
   - *Conclusion*: No ghost/fictitious tables exist in any subscription.

4. **RLS Row-Level Filtering & Resource Protection**:
   - *Observation*: Client and drawer modules (`AfiliadoDashboard`, `PurchasesPage`, `CouponsPage`, `PrestadorDetailDrawer`, `useClientNotifications`) apply `filter: 'column=eq.{id}'` along with `enabled: Boolean(id)` guards.
   - *Inference*: Sockets only receive CDC payloads for relevant client/prestador entities, preventing cross-tenant data leaks and avoiding redundant network chatter.
   - *Conclusion*: Multi-tenant security and row filtering are properly implemented.

5. **Adversarial & Integrity Review**:
   - *Observation*: Source code was inspected for dummy shims, bypasses, and hardcoded outputs. Vitest tests execute genuine assertions against Supabase channel events and debounce timers.
   - *Inference*: No integrity violations or fake passes were detected.
   - *Conclusion*: The deliverables represent genuine, robust implementations.

---

## 3. Caveats

- `src/components/client/StoreHub.tsx` was flagged with a warning in `check-realtime-audit.ts` due to an ad-hoc channel naming convention (`Date.now()`). This component belongs to Milestone 5 / Store Hub remediation and is outside the R1/R2/R3 scope; nonetheless, all R1-R3 target modules use either canonical `useRealtimeSubscription` or stable channel IDs.

---

## 4. Conclusion

All deliverables for **R1 (Hooks & Engine)**, **R2 (Admin Modules)**, and **R3 (Admin & Client Modules)** meet all quality, architectural, security, and performance criteria.

**Verdict: APPROVE**

---

## 5. Verification Method

To independently reproduce and verify this review:
1. Run Vitest test suite:
   ```powershell
   npx vitest run src/tests/realtime-hook.test.ts
   ```
2. Run automated realtime audit script:
   ```powershell
   npx tsx scripts/check-realtime-audit.ts
   ```
3. Run full production build:
   ```powershell
   npm run build
   ```
4. Verify file-by-file compliance:
   - `src/hooks/useRealtime.ts`
   - `src/hooks/useRealtimeTable.ts`
   - R2 modules: `ProdutosModule.tsx`, `OrdensAssinaturaModule.tsx`, `OrdensCompraModule.tsx`, `AdvertisingAdminModule.tsx`, `ServicePackagesModule.tsx`, `TrabalheConoscoSection.tsx`, `CareersAdminModule.tsx`, `PessoasSuperDomain.tsx`
   - R3 modules: `ConfiguracoesModule.tsx`, `OrcamentosWorkstation.tsx`, `useClientNotifications.tsx`, `AfiliadoDashboard.tsx`, `PurchasesPage.tsx`, `CouponsPage.tsx`, `PrestadorDetailDrawer.tsx`
