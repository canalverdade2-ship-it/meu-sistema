# Relatório de Handoff — Mapeamento e Auditoria dos Módulos Web Admin

> **Agente**: Web Modules Explorer  
> **Data / Timestamp**: 2026-09-19T19:18:00Z  
> **Diretório de Trabalho**: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_survey_web`  
> **Destinatário**: Parent Orchestrator (`b5cb5d24-07cb-426e-9719-3afc055d1e23`)  
> **Artefato Principal Gerado**: `survey_web_report.md` (230 KB, 4.276 linhas)

---

## 1. Observation

Durante a investigação exaustiva do diretório `src/components/admin/` e de toda a árvore de subdiretórios, foram observados e quantificados diretamente os seguintes fatos:

1. **Volume Total de Arquivos**:
   - Foram localizados exatamente **176 arquivos `.tsx`** sob `src/components/admin/` totalizando **102.457 linhas de código**.
   - Comando executado: `powershell -Command "Get-ChildItem -Path 'src/components/admin' -Filter '*.tsx' -Recurse | Measure-Object"`
   - Resultado: `Count: 176` (código de saída 0).

2. **Distribuição Física dos Arquivos por Diretório**:
   - `src/components/admin/` (raiz): 68 arquivos `.tsx`
   - `src/components/admin/super-domains/`: 51 arquivos `.tsx`
     - `super-domains/contratos/`: 8 arquivos
     - `super-domains/financeiro/`: 11 arquivos
     - `super-domains/governanca/`: 8 arquivos
     - `super-domains/operacoes/`: 9 arquivos
     - `super-domains/pessoas/`: 11 arquivos
     - `super-domains/shared/`: 4 arquivos
   - `src/components/admin/relatorios/`: 15 arquivos `.tsx`
   - `src/components/admin/gsa-tv/`: 10 arquivos `.tsx`
   - `src/components/admin/products/`: 8 arquivos `.tsx` (inclui subdiretório `products/import/`)
   - `src/components/admin/prestadores/`: 7 arquivos `.tsx`
   - `src/components/admin/demandas/`: 6 arquivos `.tsx`
   - `src/components/admin/infra/`: 4 arquivos `.tsx`
   - `src/components/admin/ui/`: 4 arquivos `.tsx`
   - `src/components/admin/ecommerce/`: 2 arquivos `.tsx`
   - `src/components/admin/clientes/`: 1 arquivo `.tsx`
   - Diretórios vazios detectados (sem arquivos `.tsx`): `src/components/admin/saude/`, `src/components/admin/seguros/`. Seus módulos correspondentes residem na raiz (`ProtectionAdminModule.tsx`) e em `super-domains/contratos/` (`GsaSaudeView.tsx`, `GsaSegurosView.tsx`).

3. **Dependências de Banco de Dados e RPCs**:
   - Foram identificadas **129 tabelas únicas do Supabase** acessadas diretamente por chamadas `.from(...)`, `tables: [...]` ou `clientOperationalWrite(...)`.
   - As 5 tabelas com maior frequência de acesso são:
     - `clientes`: 34 componentes
     - `faturas`: 21 componentes
     - `ordens_servico`: 15 componentes
     - `prestador_demandas`: 15 componentes
     - `system_settings`: 14 componentes
   - Foram identificadas **147 funções RPC únicas** chamadas via `callAdminRpc`, `supabase.rpc` ou `callClientRpc`.
   - As 5 RPCs mais acionadas são:
     - `gsa_admin_processar_saque`: 6 chamadores
     - `gsa_admin_baixar_fatura`: 5 chamadores
     - `gsa_admin_list_resource`: 4 chamadores
     - `gsa_admin_reset_actor_pin`: 4 chamadores
     - `gsa_admin_access_snapshot`: 3 chamadores

4. **Integrações de Borda e Microserviços**:
   - 9 endpoints de Edge Functions gerenciados via `infraService.ts`: `vps-api/metrics`, `vps-api/power`, `cloudflare-api/analytics`, `cloudflare-api/r2-files`, `cloudflare-api/zone`, `cloudflare-api/dns`, `cloudflare-api/purge-cache`, `cloudflare-api/dev-mode`, `cloudflare-api/under-attack`.
   - Terminal WebSockets SSH (`VPSTerminal.tsx`) conectado em `/functions/v1/ssh-proxy`.
   - Gateway de Mensageria WhatsApp Evolution API monitorado por `WhatsAppHealthMonitor.tsx` e configurado por `WhatsAppQRCodeManager.tsx`.

5. **Distribuição de Complexidade Mobile**:
   - **Alta Complexidade**: 48 componentes (módulos com tabelas densas, múltiplos modais, realtime e múltiplas RPCs).
   - **Média Complexidade**: 89 componentes (formulários intermediários, listagens com filtros, drawers).
   - **Baixa Complexidade**: 39 componentes (views informativas, cards de navegação, wizards simples).

---

## 2. Logic Chain

A dedução e síntese foram estruturadas passo a passo:

- **Passo 1 (Enumeração Completa)**: A varredura via scripts Node.js (`scratch/deep_analyze_admin.cjs` e `scratch/enrich_survey.cjs`) garantiu 100% de cobertura determinística sem truncamento, identificando cada um dos 176 arquivos `.tsx`.
- **Passo 2 (Taxonomia de Domínio)**: O exame dos arquivos revelou que os módulos administrativos se organizam em **9 Esquadrões de Domínio Funcional (Squads)**:
  - **Squad 1**: Core, Governança & Infraestrutura (29 componentes, 11.978 linhas)
  - **Squad 2**: Financeiro, Cobrança & Fiscal (20 componentes, 17.529 linhas)
  - **Squad 3**: Contratos, Jurídico & Grandes Contas (8 componentes, 5.087 linhas)
  - **Squad 4**: Pessoas, CRM, Cadastros & Parceiros (27 componentes, 23.579 linhas)
  - **Squad 5**: Operações, Demandas & Atendimento (23 componentes, 13.445 linhas)
  - **Squad 6**: E-commerce, Catálogo, Loja & Fidelidade (27 componentes, 15.034 linhas)
  - **Squad 7**: Mídia, GSA TV & Publicidade (23 componentes, 10.004 linhas)
  - **Squad 8**: Benefícios, Seguros & Viagens (3 componentes, 3.048 linhas)
  - **Squad 9**: BI, Relatórios & Analytics (16 componentes, 2.753 linhas)
- **Passo 3 (Análise de Capacidades Interativas)**: Constatou-se que a interface web utiliza fortemente tabelas HTML com mais de 8 a 12 colunas, filtros simultâneos em cascata, drawers laterais (`SlideOver`) e modais aninhados.
- **Passo 4 (Diretriz de Transposição Mobile)**: Para garantir paridade funcional sem violar a usabilidade nativa (evitando elementos com larguras fixas de 1000px), a migração deve:
  - Adotar `FlashList` com cartões verticais expansíveis.
  - Converter `SlideOver` / `Drawer` para `BottomSheetModal` (@gorhom/bottom-sheet).
  - Converter tabelas de formulários massivos em `FormWizard` por passos (Steppers).
  - Empregar chips horizontais de filtragem rápida com badges numéricos.

---

## 3. Caveats

1. **Acessos Diretos a Tabelas**: 129 tabelas são acessadas diretamente por chamadas `supabase.from(...)` nos componentes front-end web. Na migração para React Native, a sessão autenticada deve transportar o token JWT ativo para respeitar as políticas de RLS (Row Level Security) do PostgreSQL.
2. **Terminal SSH no Mobile**: O componente `VPSTerminal.tsx` utiliza a biblioteca web `xterm.js` com WebSocket direto. Em ambiente mobile nativo, emular um terminal interativo exigirá biblioteca compatível com React Native ou, alternativamente, uma visão mobile simplificada de execução de comandos rápidos e streaming de logs.
3. **Diretórios Vazios**: Os diretórios `src/components/admin/saude/` e `src/components/admin/seguros/` foram identificados como vazios na árvore de arquivos web. As funcionalidades de Saúde e Seguros estão implementadas em `ProtectionAdminModule.tsx` e nas views de `super-domains/contratos/`.

---

## 4. Conclusion

O levantamento sistemático de 100% dos componentes administrativos web do ERP GSA foi concluído com sucesso. Todos os **176 componentes `.tsx`** foram catalogados, analisados detalhadamente em termos de código, tabelas Supabase (129 tabelas), funções RPC (147 RPCs), integrações externas e capacidades interativas, sendo alocados em **9 Esquadrões de Migração (Squads)**.

O relatório técnico completo de 4.276 linhas foi compilado e publicado no arquivo `survey_web_report.md` na pasta do agente, fornecendo o mapa arquitetural completo e imediato para a execução das equipes de migração React Native / Expo.

---

## 5. Verification Method

Para verificar de forma independente e reproduzível os dados apresentados neste handoff:

1. **Verificação de Contagem de Arquivos**:
   ```powershell
   Get-ChildItem -Path 'src/components/admin' -Filter '*.tsx' -Recurse | Measure-Object
   # Esperado: Count: 176
   ```

2. **Verificação da Análise Estruturada e Squads**:
   ```powershell
   node scratch/deep_analyze_admin.cjs
   # Esperado: "Analyzed 176 files successfully. Total verified: 176 / 176"
   ```

3. **Inspeção do Relatório Completo**:
   - Abrir e inspecionar o arquivo:
     `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_survey_web\survey_web_report.md`
   - O documento contém todos os 176 componentes listados individualmente com tabelas, RPCs, complexidade e diretrizes de adaptação mobile.
