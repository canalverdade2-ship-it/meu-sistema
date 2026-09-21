# DISPATCH — Worker Squad 4: CRM, VIP, Support & Protection

## Objective
Implement native React Native mobile screens for all 8 modules in Squad 4 under `gsa-admin-mobile/src/screens/crm/`.

## Exclusive Write Ownership
You exclusively own and write to:
`gsa-admin-mobile/src/screens/crm/*`
Do NOT edit `App.tsx` or files owned by other squads.

## Modules to Implement
1. `ClientesModuleScreen.tsx` (CRM 360 de clientes PF e PJ, historico, saldo e pontos)
   - Source: `src/components/admin/ClientesModule.tsx`
   - Data: `clientes`, `orcamentos`, `faturas`, `ordens_servico`
2. `CadastroModuleScreen.tsx` (Central de novos cadastros unificados: clientes, parceiros, tecnicos)
   - Source: `src/components/admin/CadastroModule.tsx`
   - Data: `clientes`, `prestadores`, `parceiros`
3. `AreaVIPModuleScreen.tsx` (Gestao de membros VIP, planos de anuidade e beneficios)
   - Source: `src/components/admin/AreaVIPModule.tsx`
   - Data: `area_vip_membros`, `vip_beneficios`
4. `TicketsModuleScreen.tsx` (Helpdesk, chamados de suporte, atendimento e SLA)
   - Source: `src/components/admin/TicketsModule.tsx`
   - Data: `tickets`, `ticket_mensagens`
5. `ProtectionAdminModuleScreen.tsx` (Gestao de planos GSA Saude e GSA Seguros)
   - Source: `src/components/admin/ProtectionAdminModule.tsx`
   - Data: `gsa_saude_planos`, `gsa_seguros_apolices`
6. `EmpresaModuleScreen.tsx` (Hub de contas corporativas, convenios PJ e contratos de empresas)
   - Source: `src/components/admin/EmpresaModule.tsx`
   - Data: `empresas_convenios`, `clientes`
7. `IndicacoesModuleScreen.tsx` (Programa Indique e Ganhe, rastreamento de leads e indicados)
   - Source: `src/components/admin/IndicacoesModule.tsx`
   - Data: `indicacoes`, `clientes`
8. `ClassifiedsModuleScreen.tsx` (Moderacao de anuncios classificados da comunidade)
   - Source: `src/components/admin/ClassifiedsModule.tsx`
   - Data: `classificados_anuncios`

Also create `index.ts` in `gsa-admin-mobile/src/screens/crm/` exporting all screens.

## UX Adaptation Rules
- Card-based layout (`FlatList` or `ScrollView`) with search, filter chips, pull-to-refresh (`RefreshControl`).
- Status badges with contextual colors.
- Detail modals or bottom sheets for full record inspection.
- Form inputs with `keyboardType`, touch targets >= 44x44, responsive 100% width.
- NO hardcoded desktop widths (> 420px), NO HTML `<table>` elements.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## 2026-09-19T19:19:10Z
You are Worker Squad 4: CRM, VIP, Support & Protection.
Your working directory is:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_squad4

Read the user request at:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\ORIGINAL_REQUEST.md (under header ## 2026-09-19T19:10:56Z)
and your dispatch instructions at:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_squad4\DISPATCH.md

You exclusively own and write to:
gsa-admin-mobile/src/screens/crm/*

Implement all 8 native mobile screens for Squad 4:
1. ClientesModuleScreen.tsx
2. CadastroModuleScreen.tsx
3. AreaVIPModuleScreen.tsx
4. TicketsModuleScreen.tsx
5. ProtectionAdminModuleScreen.tsx
6. EmpresaModuleScreen.tsx
7. IndicacoesModuleScreen.tsx
8. ClassifiedsModuleScreen.tsx
plus index.ts exporting all 8 screens.

