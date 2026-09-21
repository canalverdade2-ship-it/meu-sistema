## 2026-08-26T14:19:15Z

You are worker_m4_demandas_ops.
Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_m4_demandas_ops
Workspace root: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)

MANDATORY FIRST STEP: Read the user request verbatim in:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md (specifically timestamp 2026-08-26T13:52:52Z) and PROJECT.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Scope: Milestone 4 — Admin Demandas Module (R9) & Regular Admin Operational Modules (R10).
Exclusive File Ownership:
- Demandas:
  1. src/components/admin/DemandasColaboradorModule.tsx
  2. src/components/admin/demandas/DemandasDashboard.tsx
  3. src/components/admin/demandas/DemandasComentarios.tsx
  4. src/components/admin/demandas/DemandasDetalhesModal.tsx
  5. src/components/admin/demandas/NovaDemandaModal.tsx
- Operational Modules:
  6. src/components/admin/FornecedoresModule.tsx
  7. src/components/admin/ServicePackagesModule.tsx
  8. src/components/admin/OrdensCompraModule.tsx
  9. src/components/admin/OrdensAssinaturaModule.tsx
  10. src/components/admin/ProdutosModule.tsx
  11. src/components/admin/ServicosModule.tsx
  12. src/components/admin/TravelAdminModule.tsx
  13. src/components/admin/ViagensCategoriasModule.tsx
  14. src/components/admin/prestadores/AdminPrestadorDocumentos.tsx
  15. src/components/admin/AdvertisingAdminModule.tsx
  16. src/components/admin/AssinaturasModule.tsx
  17. src/components/admin/ClassifiedsModule.tsx
  18. src/components/admin/FiscalModule.tsx
  19. src/components/admin/ProtectionAdminModule.tsx
  20. src/components/admin/ScrapingAdminModule.tsx
  21. src/components/admin/SiteCampaignAdminModule.tsx
  22. src/components/admin/VendasModule.tsx

Tasks:
- Use canonical useRealtimeSubscription / useRealtime from src/hooks/useRealtime.ts across all listed files.
- In Demandas: Subscribe to prestador_demandas, prestador_demandas_historico, demanda_comentarios, os_notas, os_suporte_mensagens.
- In Operational Modules: Subscribe to corresponding tables (ornecedores, catalog_packages, ordens_compra, ordens_assinatura, produtos, servicos, iagens_pacotes, iagens_categorias, prestador_documentos, classificados_anuncios, etc.) with proper channel unmount cleanup.
- Run 
px vitest run src/tests and 
pm run build to verify exit code 0 and zero regressions.
- Write handoff.md and report back.
