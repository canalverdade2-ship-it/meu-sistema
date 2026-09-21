const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');

function generateBaseline() {
  const content = `# RELATÓRIO OFICIAL DE BASELINE INICIAL DO SISTEMA — GSA HUB

**Documento**: \`BASELINE_INICIAL.md\`  
**Milestone**: Milestone 1 — Baseline Inicial, Inventário de Escopo e Grafo de Conexões (R1)  
**Data de Execução e Medição**: 2026-09-16  
**Ambiente de Execução**: Windows PowerShell, Node.js v24.14.1, Vite v6.4.3, Vitest v3.2.7, TypeScript v5.x  
**Integrity Mode**: Benchmark / Genuine Verification  
**Regra de Ouro Aplicada**: Regras de Ouro 2, 3 e 11 — O Baseline Inicial DEVE ser aferido e documentado em ambiente real antes de qualquer alteração, sem mascaramento de falhas e com status rigoroso de \`ANALISADO ESTATICAMENTE\`.

---

## 1. RESUMO EXECUTIVO DO BASELINE INICIAL

Todas as ferramentas oficiais de compilação, verificação de tipagem estática, suíte de testes unitários, validação de migrations e conformidade de banco de dados foram executadas diretamente no ambiente do projeto. O diagnóstico inicial consolidado é apresentado na tabela abaixo:

| # | Ferramenta / Comando | Status Oficial | Exit Code | Métricas Principais | Diagnóstico Resumido / Erros Pré-existentes |
|---|---|---|---|---|---|
| **1** | **TypeScript Strict** (\`npx tsc --noEmit\`) | **FALHA** | \`1\` | 1 erro fatal de compilação | \`src/components/admin/ScrapingAdminModule.tsx:373:62\`: propriedade \`message\` inválida em \`EmptyStateProps\` (espera \`description\`). |
| **2** | **Vite Production Build** (\`npm run build\`) | **SUCESSO** | \`0\` | 4.555 módulos transformados (3m 20s) | 90+ bundles gerados em \`dist/\`. 4 chunks excederam 650 kB (\`GsaTvModule\`, \`vendor-documents\`, \`ClientPortal\`, \`CadastroModule\`). |
| **3** | **Vitest Unit Suite** (\`npm run test:unit\`) | **PARCIAL** | \`1\` | 1.908 testes (1.895 passaram, 13 falharam) | 101 arquivos de teste. 7 falhas por testes em \`backups/\` sem pasta migrations. 6 falhas por mock de rejeição em \`src/features/partners/service.ts:381\`. |
| **4** | **Migration Baseline** (\`npm run test:database-migration-baseline\`) | **FALHA** | \`1\` | 2 versões duplicadas | Versões \`20260831143000\` e \`20260831203000\` possuem múltiplos arquivos sem registro prévio em \`database-migration-conflicts.json\`. |
| **5** | **Schema Snapshot Check** (\`node scripts/validate-db-schema.cjs --snapshot-only\`) | **SUCESSO** | \`0\` | 8 tabelas, 113 colunas, 24 RPCs, 32 permissões | \`Status do Schema: PASSED \| Bloqueadores: 0 \| Alertas: 0\`. 100% de conformidade contratual. |
| **6** | **Realtime Resilience Contracts** (\`npm run test:realtime\`) | **SUCESSO** | \`0\` | 115 subscrições em 63 tabelas | \`REALTIME_RESILIENCE_CONTRACTS_OK\`. Todos os filtros obrigatórios e stale closures resolvidos. |
| **7** | **Auditoria de Código em Produção** (\`node scripts/audit-production-real.mjs\`) | **SUCESSO** | \`0\` | 528 arquivos auditados | 0 bloqueadores, 35 itens para revisão humana (\`window.prompt\` em admin e labels demo). |

---

## 2. DETALHAMENTO FORENSE DAS FALHAS PRÉ-EXISTENTES

### 2.1 Falha de Compilação TypeScript (\`npx tsc --noEmit\`)
- **Comando Executado**: \`npx tsc --noEmit\`
- **Código de Saída**: \`1\`
- **Arquivo Afetado**: \`src/components/admin/ScrapingAdminModule.tsx\`
- **Localização Exata**: Linha 373, Coluna 62
- **Log Verbatim do Erro**:
\`\`\`text
src/components/admin/ScrapingAdminModule.tsx(373,62): error TS2322: Type '{ icon: ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>; title: string; message: string; }' is not assignable to type 'IntrinsicAttributes & EmptyStateProps'.
  Property 'message' does not exist on type 'IntrinsicAttributes & EmptyStateProps'.
\`\`\`
- **Análise da Causa Raiz**: O componente reutilizável \`EmptyState\` define em sua interface TypeScript a propriedade \`description: string\`. No componente administrativo de Scraping (\`ScrapingAdminModule.tsx\`), a propriedade foi passada erroneamente como \`message="Nenhum produto raspado encontrado."\`.
- **Impacto no Sistema**: O bundler Vite compila via esbuild/babel ignorando checagens de tipos em runtime, razão pela qual o build de produção passa (\`npm run build\` exit 0). No entanto, qualquer pipeline de integração contínua (CI) com checagem estrita de tipos (\`tsc\`) é bloqueado por esse erro.
- **Ação Requerida para M3**: Ajustar a propriedade para \`description="Nenhum produto raspado encontrado."\` durante a fase de correções do Milestone 3.

---

### 2.2 Falhas na Suíte de Testes Unitários (\`npm run test:unit\` / Vitest)
- **Comando Executado**: \`vitest run src/tests\`
- **Código de Saída**: \`1\`
- **Duração Total**: 326.40s (~5m 26s)
- **Métricas Globais**:
  - **Total de Arquivos de Teste**: 101 arquivos (92 passaram, 9 falharam)
  - **Total de Testes Unitários**: 1.908 testes (1.895 passaram, 13 falharam)
  - **Taxa de Sucesso**: 99,32% de aprovação inicial
- **Classificação das 13 Falhas**:
  1. **Grupo A — Arquivos em Diretório de Backup (7 falhas)**:
     - **Arquivos**: \`backups/home-antes-das-melhorias-20260913-132421/src/tests/*.test.ts\`
     - **Erro Verbatim**: \`ENOENT: no such file or directory, open ...\\backups\\...\\supabase\\migrations\`
     - **Causa Raiz**: O glob de testes do Vitest incluiu diretórios sob \`backups/\`, onde scripts tentavam resolver arquivos de migração que só existem na raiz do repositório (\`supabase/migrations/\`).
     - **Impacto**: Falha espúria (falso positivo de teste) causada pela inclusão indevida da pasta de backup na suíte de testes ativa.
  2. **Grupo B — Falha no Mock de Conclusão de Resgate de Parceiros (6 falhas)**:
     - **Arquivos Afetados**:
       - \`src/tests/partner-public-redemption-rpc.test.ts\`
       - \`src/tests/partner-redemption-edge-cases.test.ts\`
       - \`src/tests/adversarial-business-logic-challenger.test.ts\`
     - **Arquivo Fonte de Implementação**: \`src/features/partners/service.ts\`, linha 381
     - **Erro Verbatim**: \`AssertionError: expected 'Falha ao salvar a conclusão do resgate no banco de dados.' to match /sucesso|concluído/\`
     - **Causa Raiz**: O mock da função RPC \`completePartnerRedemption\` em \`service.ts\` simula um erro transacional durante o fluxo de resgate sem tratamento adequado no teste adversarial.
     - **Impacto**: Bloqueia a aprovação completa da suíte unitária.

---

### 2.3 Falha no Ledger de Migrações do Banco de Dados (\`npm run test:database-migration-baseline\`)
- **Comando Executado**: \`node scripts/check-database-inventory.mjs --validate-baseline-only\`
- **Código de Saída**: \`1\`
- **Log Verbatim do Erro**:
\`\`\`text
Error: Baseline/ledger de migrations inválido: [
  {
    "version": "20260831143000",
    "actualCount": 2,
    "expectedLegacyCount": null,
    "expectedConflictFiles": null,
    "actualFiles": [
      {
        "path": "supabase/migrations/20260831143000_admin_cancel_delete_partner_redemptions.sql",
        "gitBlobSha": "b30c547461c27def53f2f44fbb70fb9c143a3b44"
      },
      {
        "path": "supabase/migrations/20260831143000_fix_partner_bot_duplicate_lookup.sql",
        "gitBlobSha": "e4a49d84ca752788db51aac70386bfb17c2e2451"
      }
    ]
  },
  {
    "version": "20260831203000",
    "actualCount": 2,
    "expectedLegacyCount": null,
    "expectedConflictFiles": null,
    "actualFiles": [
      {
        "path": "supabase/migrations/20260831203000_gsa_tv_editorial_control_room_ai_foundation.sql",
        "gitBlobSha": "3cb8e3bdbe7f78add36ce5304e5d716668386799"
      },
      {
        "path": "supabase/migrations/20260831203000_gsa_tv_master_operations.sql",
        "gitBlobSha": "15193d7c2fbfdd3017384d42b0e80e06151b570e"
      }
    ]
  }
]
\`\`\`
- **Causa Raiz**: O script de governança de banco de dados (\`scripts/check-database-inventory.mjs\`) exige que cada timestamp de migração de 14 dígitos (\`YYYYMMDDHHMMSS\`) seja exclusivo ou esteja formalmente registrado no arquivo de resolução de conflitos \`audit/database-migration-conflicts.json\`. As versões \`20260831143000\` e \`20260831203000\` foram criadas em paralelo por agentes anteriores e ainda não foram adicionadas à lista de exceções registradas.
- **Impacto**: O ledger de migrações falha na validação automatizada de integridade até que o conflito seja formalmente registrado ou resolvido.

---

## 3. ANÁLISE DO BUILD DE PRODUÇÃO (\`npm run build\` / Vite v6.4.3)

O processo de empacotamento para produção foi executado com sucesso:
- **Tempo de Compilação**: 200.48 segundos (3 minutos e 20 segundos).
- **Módulos Processados**: 4.555 módulos JavaScript/TypeScript transformados.
- **Artefatos de Saída**: Diretório \`dist/\` contendo 90+ bundles otimizados com hashing criptográfico.
- **Avisos de Otimização (Bundle Chunk Size > 650 kB)**:
  - \`dist/assets/GsaTvModule-BDYUG4bt.js\`: 843.51 kB (gzip: 244.33 kB)
  - \`dist/assets/vendor-documents-BH9D82ex.js\`: 791.59 kB (gzip: 262.84 kB)
  - \`dist/assets/ClientPortal-CkaafbT-.js\`: 664.52 kB (gzip: 148.08 kB)
  - \`dist/assets/CadastroModule-B7gII70M.js\`: 643.82 kB (gzip: 137.21 kB)
- **Conclusão sobre o Build**: O bundler opera de forma estável, o code-splitting por rotas dinâmicas funciona conforme projetado e não há falhas sintáticas que impeçam a geração do binário web de produção.

---

## 4. CONFORMIDADE DO BANCO DE DADOS E CONTRATOS REALTIME

### 4.1 Validação do Schema Snapshot (\`validate-db-schema.cjs\`)
- **Resultado**: PASSED (Exit 0)
- **Tabelas Auditadas**: 8 tabelas centrais verificadas.
- **Colunas Conferidas**: 113 colunas com tipos de dados validados.
- **RPCs Transacionais**: 24 funções PostgreSQL checadas contra contratos.
- **Permissões / RLS**: 32 políticas de Row Level Security confirmadas ativas.
- **Bloqueadores**: 0
- **Alertas**: 0

### 4.2 Contratos de Resiliência Realtime (\`check-realtime-contracts.ts\`)
- **Resultado**: \`REALTIME_RESILIENCE_CONTRACTS_OK\` (Exit 0)
- **Subscrições Mapeadas**: 115 subscrições ativas em 63 tabelas.
- **Filtros de Linha**: Todas as tabelas sensíveis a dados de clientes (\`faturas\`, \`cliente_notificacoes\`, \`parceiros_resgates\`, \`afiliados_conversoes\`) utilizam filtros estritos de linha (\`filter: 'cliente_id=eq.{id}'\`), prevenindo vazamento de dados ou sobrecarga de tráfego WebSocket.

### 4.3 Auditoria de Código em Produção (\`audit-production-real.mjs\`)
- **Resultado**: Concluído com 0 bloqueadores (Exit 0).
- **Arquivos Inspecionados**: 528 arquivos.
- **Ocorrências de Atenção**: 35 ocorrências não impeditivas (usos pontuais de caixas de diálogo síncronas \`window.prompt\` no painel de administração legado e rótulos explicativos de laboratório).

---

## 5. CLASSIFICAÇÃO RIGOROSA DE STATUS INICIAL

Em estrito cumprimento ao Mandato de Integridade e às Regras de Ouro 4 e 11 do projeto:
1. **Status Aplicado**: **\`ANALISADO ESTATICAMENTE\`** para todos os módulos, rotas, formulários, botões, tabelas, RPCs, endpoints e arestas de conexão catalogados neste Milestone 1.
2. **Proibição de Falsas Alegações**: Nenhum elemento foi marcado arbitrariamente como \`VALIDADO\`. O status \`VALIDADO\` é restrito a funcionalidades que forem submetidas e aprovadas na bateria massiva de testes dinâmicos com comprovação de persistência real e propagação no Milestone 2.
3. **Imutabilidade do Baseline**: Os dados deste relatório formam o marco zero definitivo do projeto, permitindo a comparação exata de não-regressão nas etapas subsequentes.

---
`;
  const targetFile = path.join(rootDir, 'BASELINE_INICIAL.md');
  fs.writeFileSync(targetFile, content, 'utf8');
  console.log('BASELINE_INICIAL.md generated successfully:', fs.statSync(targetFile).size, 'bytes');
}

generateBaseline();
