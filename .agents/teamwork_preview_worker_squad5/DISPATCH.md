# DISPATCH — Worker Squad 5: Growth, Affiliates, Loyalty & Media (GSA TV)

## Objective
Implement native React Native mobile screens for all 14 modules in Squad 5 under `gsa-admin-mobile/src/screens/growth/`.

## Exclusive Write Ownership
You exclusively own and write to:
`gsa-admin-mobile/src/screens/growth/*`
Do NOT edit `App.tsx` or files owned by other squads.

## Modules to Implement
1. `AffiliateAdminModuleScreen.tsx` (Rede de afiliados, comissoes, links de indicacao)
   - Source: `src/components/admin/AffiliateAdminModule.tsx`
   - Data: `afiliados`, `gsa_afiliado_comissoes`, `gsa_afiliado_saques`
2. `PremiosModuleScreen.tsx` (Catalogo de premios por pontuacao de fidelidade)
   - Source: `src/components/admin/PremiosModule.tsx`
   - Data: `premios`, `premios_resgates`
3. `VouchersModuleScreen.tsx` (Emissao, validacao e resgate de vouchers digitais)
   - Source: `src/components/admin/VouchersModule.tsx`
   - Data: `vouchers`, `parceiros`
4. `AdvertisingAdminModuleScreen.tsx` (Campanhas publicitarias, banners e patrocinios)
   - Source: `src/components/admin/AdvertisingAdminModule.tsx`
   - Data: `gsa_ad_campaigns`, `gsa_ad_placements`
5. `TravelAdminModuleScreen.tsx` (GSA Viagens: pacotes turisticos, passagens, reservas)
   - Source: `src/components/admin/TravelAdminModule.tsx`
   - Data: `viagens_pacotes`, `viagens_reservas`
6. `ViagensCategoriasModuleScreen.tsx` (Categorias e destinos turisticos cadastrados)
   - Source: `src/components/admin/ViagensCategoriasModule.tsx`
   - Data: `viagens_categorias`
7. `CareersAdminModuleScreen.tsx` (Candidaturas e processos seletivos do GSA Carreiras)
   - Source: `src/components/admin/CareersAdminModule.tsx`
   - Data: `gsa_careers_applications`, `gsa_careers_vacancies`
8. `CareerVacanciesManagerScreen.tsx` (Abertura e edicao de vagas de emprego)
   - Source: `src/components/admin/CareerVacanciesManager.tsx`
   - Data: `gsa_careers_vacancies`
9. `GsaTvModuleScreen.tsx` (Painel central da emissora GSA TV)
   - Source: `src/components/admin/GsaTvModule.tsx`
   - Data: `gsa_tv_channels`, `gsa_tv_programs`
10. `GsaTvControlRoomScreen.tsx` (Sala de controle da transmissao ao vivo)
    - Source: `src/components/admin/GsaTvControlRoom.tsx`
    - Data: `gsa_tv_live_sessions`
11. `GsaTvLiveConsoleScreen.tsx` (Console de telemetria da transmissao em tempo real)
    - Source: `src/components/admin/GsaTvLiveConsole.tsx`
    - Data: `gsa_tv_streams`
12. `GsaTvLiveSourcesScreen.tsx` (Gestao de fluxos RTMP/SRT e cameras de estudio)
    - Source: `src/components/admin/GsaTvLiveSources.tsx`
    - Data: `gsa_tv_sources`
13. `GsaTvGraphicsScreen.tsx` (Gerador de caracteres, GCs, lower thirds e vinhetas)
    - Source: `src/components/admin/GsaTvGraphics.tsx`
    - Data: `gsa_tv_graphics`
14. `GsaTvRightsScreen.tsx` (Contratos de direitos de transmissao e acervo musical)
    - Source: `src/components/admin/GsaTvRights.tsx`
    - Data: `gsa_tv_rights`, `gsa_tv_tracks`

Also create `index.ts` in `gsa-admin-mobile/src/screens/growth/` exporting all screens.

## UX Adaptation Rules
- Card-based layout (`FlatList` or `ScrollView`) with search, filter chips, pull-to-refresh (`RefreshControl`).
- Status badges with contextual colors.
- Detail modals or bottom sheets for full record inspection.
- Form inputs with `keyboardType`, touch targets >= 44x44, responsive 100% width.
- NO hardcoded desktop widths (> 420px), NO HTML `<table>` elements.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## 2026-09-19T19:19:11Z
You are Worker Squad 5: Growth, Affiliates, Loyalty & Media (GSA TV).
Your working directory is:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_squad5

Read the user request at:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\ORIGINAL_REQUEST.md (under header ## 2026-09-19T19:10:56Z)
and your dispatch instructions at:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_squad5\DISPATCH.md

You exclusively own and write to:
gsa-admin-mobile/src/screens/growth/*

Implement all 14 native mobile screens for Squad 5:
1. AffiliateAdminModuleScreen.tsx
2. PremiosModuleScreen.tsx
3. VouchersModuleScreen.tsx
4. AdvertisingAdminModuleScreen.tsx
5. TravelAdminModuleScreen.tsx
6. ViagensCategoriasModuleScreen.tsx
7. CareersAdminModuleScreen.tsx
8. CareerVacanciesManagerScreen.tsx
9. GsaTvModuleScreen.tsx
10. GsaTvControlRoomScreen.tsx
11. GsaTvLiveConsoleScreen.tsx
12. GsaTvLiveSourcesScreen.tsx
13. GsaTvGraphicsScreen.tsx
14. GsaTvRightsScreen.tsx
plus index.ts exporting all 14 screens.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Follow Mobile UX patterns (Table-to-Card, touch targets >= 44x44, responsive 100% width, no 1000px fixed tables). Wire Supabase queries/actions using the Supabase client.
When done, create your handoff.md and send a message back to parent.
