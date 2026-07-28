# Manual Técnico do GSA HUB

**Versão documental:** 1.0  
**Data de consolidação:** 28 de julho de 2026  
**Repositório:** `canalverdade2-ship-it/meu-sistema`  
**Branch de auditoria:** `audit/full-system-remediation-20260727`

## 1. Objetivo e escopo

Este manual descreve a arquitetura, os portais, os módulos, a autenticação, o banco de dados, as Edge Functions, os testes, os processos operacionais e os controles de segurança do GSA HUB.

A documentação deve ser lida em conjunto com o código. As fontes de verdade principais são:

- rotas: `src/routing/routeCatalog.ts` e `src/routing/routeMatcher.ts`;
- autorização de rotas: `src/routing/routeSecurity.ts`;
- sessão e autenticação: `src/lib/sessionService.ts` e `supabase/functions/gsa-auth-session`;
- composição da aplicação: `src/App.tsx`;
- módulos administrativos: `src/pages/AdminPanel.tsx`;
- migrations: `supabase/migrations`;
- configuração de Edge Functions: `supabase/config.toml`;
- comandos operacionais: `package.json` e diretório `scripts`;
- pipelines: `.github/workflows`.

Este documento não substitui a validação do ambiente de produção. Alterações no banco, secrets, domínios, integrações financeiras ou serviços externos precisam ser verificadas no ambiente real antes da liberação.

## 2. Arquitetura geral

### 2.1 Camada web

- React 19;
- TypeScript;
- Vite;
- TanStack Query para estado assíncrono;
- React Hook Form e Zod para formulários e validação;
- Framer Motion para transições;
- Playwright para testes ponta a ponta;
- Vitest para testes unitários.

A aplicação usa roteamento interno próprio, sem depender de React Router. O estado da URL é interpretado por `useAppLocation` e `matchRoute`, e as mudanças de rota passam pelo serviço de navegação central.

### 2.2 Backend e dados

- Supabase Auth;
- PostgreSQL;
- Row Level Security (RLS);
- RPCs PostgreSQL para operações transacionais e privilegiadas;
- Supabase Storage para documentos e arquivos;
- Edge Functions em Deno para autenticação, publicidade, importações e integrações públicas/controladas;
- Supabase Realtime nos módulos que exigem atualização imediata.

### 2.3 Princípio de segurança

O navegador nunca deve possuir `service_role`, senha de banco, segredo HMAC, segredo de cron ou credencial privada de integração. Operações privilegiadas ficam em RPCs protegidas, políticas RLS ou Edge Functions.

## 3. Portais e áreas do sistema

### 3.1 Site público

Principais áreas:

- página inicial;
- serviços e assinaturas;
- serviços gratuitos;
- criação de sites e sistemas;
- parceiros;
- anúncios e página “Anuncie”;
- programa de afiliados;
- Trabalhe Conosco;
- Marketplace GSA.

### 3.2 Portal da pessoa física

Prefixo principal: `/cliente`.

Módulos catalogados:

- dashboard;
- perfil;
- suporte e tickets;
- serviços e assinaturas;
- orçamentos;
- serviços contratados;
- produtos;
- assinaturas;
- financeiro;
- faturas;
- notas fiscais;
- extrato;
- saques;
- transferências;
- crédito;
- empréstimos;
- fidelidade;
- pontos;
- vouchers;
- promoções;
- prêmios;
- indicações;
- área VIP;
- Marketplace.

A área exige sessão de cliente com tipo de pessoa `pf`. Uma sessão de empresa não pode permanecer em uma rota de pessoa física.

### 3.3 Portal da empresa

Prefixo principal: `/empresa`.

Módulos catalogados:

- dashboard;
- cadastro/perfil empresarial;
- suporte;
- Marketplace;
- operações;
- orçamentos;
- serviços;
- produtos;
- assinaturas;
- financeiro;
- faturas;
- extrato;
- saques;
- transferências;
- crédito;
- empréstimos;
- benefícios;
- pontos;
- vouchers;
- promoções;
- prêmios;
- indicações;
- área VIP.

A área exige sessão de cliente com tipo de pessoa `pj`. Uma sessão PF é redirecionada ao portal pessoal.

### 3.4 Painel administrativo e de colaboradores

Prefixo principal: `/admin`.

Grupos e módulos de menu consolidados no painel:

**Principal**

- Dashboard;
- Cadastros;
- Fornecedores;
- Operações;
- Minhas Demandas;
- Loja GSA Store;
- Classificados GSA;
- GSA Anúncios;
- Viagens GSA;
- GSA Afiliados;
- GSA Saúde;
- GSA Seguros.

**Financeiro**

- Financeiro;
- Cobrança;
- Fiscal;
- Empréstimos;
- Crédito da Loja.

**Relacionamento**

- Parceiros;
- Trabalhe Conosco;
- Fidelidade;
- Promoções por Quantidade;
- Área VIP;
- Atendimento.

**Comunicação**

- Avisos e Campanhas.

**Gestão e infraestrutura**

- Relatórios;
- Configurações;
- Gerenciar Acessos;
- Saúde do Sistema.

Administradores possuem acesso integral conforme as regras do sistema. Colaboradores recebem módulos explícitos. Toda navegação administrativa deve passar por `hasAdminModuleAccess`; esconder o item do menu não substitui a verificação de autorização.

### 3.5 Portal do prestador

Prefixo: `/prestador`.

- apresentação pública;
- login e cadastro;
- dashboard;
- agenda e agendamentos;
- demandas;
- documentos;
- financeiro e saques;
- vouchers;
- promoções;
- prêmios;
- suporte.

A página inicial é pública. As demais rotas exigem sessão válida e nova verificação do estado operacional do prestador.

### 3.6 Portal do fornecedor

Prefixo: `/fornecedor`.

- apresentação pública;
- login;
- dashboard;
- produtos e solicitação de novo produto;
- pedidos;
- entregas;
- financeiro.

As páginas de apresentação e acesso são públicas. Os módulos internos exigem sessão de fornecedor e validação de acesso no servidor.

### 3.7 Portal do anunciante

Prefixo: `/anuncios` para subrotas autenticadas.

- propostas;
- campanhas;
- criativos;
- financeiro;
- relatórios.

A vitrine `/anuncios` é pública. As subrotas exigem autenticação mínima e o próprio portal reconfirma vínculo e autorização no backend.

### 3.8 Programa de afiliados

- página pública;
- acesso e cadastro;
- dashboard;
- links;
- comissões;
- saques;
- perfil;
- pontos.

Apenas as rotas públicas de apresentação e acesso são anônimas. As áreas operacionais exigem cliente autenticado.

### 3.9 Trabalhe Conosco

- landing page institucional;
- acesso do candidato;
- administração de vagas e candidaturas no painel.

O fluxo possui validações de contrato próprias e pipeline dedicado de hardening.

## 4. Marketplace

### 4.1 GSA Store

Rotas públicas e autenticadas incluem:

- início da loja;
- produtos;
- detalhes de produto;
- assinaturas;
- detalhes de assinatura;
- compras;
- cupons;
- promoções;
- trocas;
- reembolsos.

Visitantes podem navegar. Operações que exigem identidade redirecionam ao login com `returnTo` validado. Carrinho e cupons de visitante podem ser migrados para a conta após autenticação.

### 4.2 Viagens GSA

Jornada principal:

1. consulta de ofertas;
2. solicitação de orçamento;
3. proposta;
4. aceite;
5. transação e passageiros;
6. documentos privados;
7. checkout;
8. vouchers;
9. cancelamento e reembolso;
10. suporte.

Valores contratados, faturados, pagos, em aberto e reembolsáveis são tratados separadamente. Reembolso depende de pagamento efetivamente conciliado.

### 4.3 Classificados

Categorias principais:

- imóveis;
- veículos;
- geral.

Fluxos associados:

- criação e edição de anúncio;
- meus anúncios;
- interesses;
- propostas;
- negociações;
- vendas;
- comissões;
- suporte;
- mídia controlada por Edge Function.

### 4.4 Saúde e seguros

Ambos os domínios possuem catálogo, cotações, propostas, contratos, documentos, assessoria, comissões, atendimento e suporte. O painel administrativo separa os submódulos de Saúde e Seguros.

## 5. Autenticação e sessão

### 5.1 Sessão GSA vinculada ao Supabase Auth

A sessão local é armazenada sob a chave `_gsa_session`, mas esse registro isolado não autentica ninguém.

Para restaurar uma sessão, o sistema exige simultaneamente:

1. identificador e token da sessão GSA;
2. sessão Supabase Auth válida;
3. metadados do JWT correspondentes ao mesmo ator e à mesma sessão;
4. validação da sessão por RPC;
5. validações operacionais adicionais conforme o perfil.

Uma divergência entre sessão GSA e Supabase Auth invalida o acesso.

### 5.2 Perfis de ator

- cliente PF;
- cliente PJ;
- administrador;
- colaborador;
- prestador;
- fornecedor.

Afiliado e anunciante utilizam vínculos e verificações complementares dentro dos respectivos fluxos.

### 5.3 Redirecionamento seguro

Rotas protegidas preservam a intenção de retorno usando `returnTo`. O valor deve ser aceito apenas quando pertence aos prefixos permitidos para o perfil. URLs externas ou prefixos de outro portal não podem ser usados para redirecionamento aberto.

### 5.4 Encerramento de sessão

O logout:

- registra ação quando aplicável;
- revoga a sessão GSA;
- encerra a sessão Supabase Auth local;
- remove chaves legadas;
- limpa informações do perfil;
- redireciona ao destino correto por tipo de ator.

## 6. Banco de dados

### 6.1 Inventário de referência

O inventário automatizado gerado em 23 de julho de 2026 registrou:

- 245 migrations remotas;
- 204 tabelas públicas;
- 527 funções públicas;
- 18 buckets de Storage.

O mesmo inventário registrou zero bloqueadores nas categorias verificadas:

- versões inesperadamente duplicadas de migration;
- migration necessária ausente no banco;
- migration remota sem equivalente reconhecido no repositório;
- tabela referenciada ausente;
- RPC referenciada ausente;
- bucket referenciado ausente;
- trigger desabilitada;
- tabela exposta sem RLS;
- função crítica exposta.

Esses números representam o inventário daquela data. Antes de uma liberação final, execute novamente `npm run test:database-inventory` contra a produção.

### 6.2 Baseline legado

O projeto mantém baseline explícito para divergências históricas já conhecidas. Não renomeie nem recrie migrations antigas para “corrigir” o histórico. Novas correções devem ser migrations cronológicas e idempotentes.

### 6.3 Regras para migrations

- nunca editar uma migration já aplicada em produção;
- usar timestamp único;
- evitar operações destrutivas sem plano de migração e rollback;
- adicionar RLS e políticas no mesmo conjunto de mudança da tabela;
- adicionar índices para filtros, joins e políticas críticas;
- documentar funções `SECURITY DEFINER` e restringir `search_path`;
- validar dependências de tabelas, funções, triggers e buckets;
- executar baseline e testes runtime em PostgreSQL temporário.

## 7. Storage

Os buckets devem ser classificados como públicos ou privados de forma explícita. Documentos pessoais, comprovantes, contratos, vouchers administrativos e arquivos operacionais devem permanecer privados e ser entregues por URL assinada ou backend autorizado.

Exemplos do módulo de viagens:

- `viagens-documentos`;
- `viagens-vouchers`.

Nunca montar caminhos apenas com nome fornecido pelo usuário. Normalize nomes e use identificadores internos do cliente, transação, passageiro ou entidade proprietária.

## 8. Edge Functions

As seguintes funções tiveram seus entrypoints verificados no fechamento de integridade:

- `gsa-ad-delivery`;
- `gsa-advertiser-access`;
- `gsa-advertiser-admin`;
- `gsa-advertising-scheduler`;
- `gsa-advertising-webhook`;
- `gsa-auth-session`;
- `gsa-classified-media`;
- `gsa-free-tools-pro`;
- `gsa-free-tools-pro-webhook`;
- `gsa-partner-application`;
- `gsa-public-advertising`;
- `gsa-public-budget`;
- `import-product-from-url`;
- `import-products-from-file`.

### 8.1 Funções públicas

`verify_jwt = false` não significa acesso irrestrito. Funções públicas precisam aplicar os controles adequados ao risco:

- lista explícita de origens CORS;
- rate limit;
- validação de payload;
- proteção contra SSRF;
- HMAC em webhooks;
- segredo próprio em agendadores;
- conferência de pagamento no servidor;
- uso restrito de `service_role` dentro da função;
- resposta sem dados sensíveis.

### 8.2 Funções administrativas

`gsa-advertiser-admin` mantém verificação JWT e reconfirma o usuário e o módulo permitido no servidor. O mesmo princípio deve ser aplicado a qualquer nova função administrativa.

### 8.3 Testes determinísticos existentes

O fechamento executa testes para parsers, schemas de importação, SSRF, autenticação, publicidade, orçamento público e importação de arquivo. Todos os testes `*_test.ts` encontrados são executados automaticamente.

## 9. Publicidade

Controles obrigatórios:

- `ADVERTISING_ALLOWED_ORIGINS` com origens HTTPS explícitas;
- rejeição de origem externa não autorizada, inclusive em preflight;
- HMAC no webhook;
- segredo no scheduler;
- JWT e permissão de módulo em operações administrativas;
- limitação de requisições;
- métricas e entregas tratadas por operações idempotentes.

## 10. Exportações institucionais

### 10.1 PDF

As exportações PDF usam a camada institucional compartilhada. Mudanças devem preservar identidade, cabeçalhos, metadados, confidencialidade, paginação e legibilidade.

### 10.2 Excel/XLSX

O exportador institucional mantém o contrato de `exceljs`, mas o navegador usa um adaptador interno baseado em `@redoper1/xlsx-js-style`.

Arquivos principais:

- `src/lib/institutionalExcelExport.ts`;
- `src/lib/exceljsBrowserAdapter.ts`;
- `src/types/excel-export-adapter.d.ts`;
- `scripts/check-institutional-excel-adapter.ts`.

A prova automatizada valida:

- geração de arquivo XLSX;
- conteúdo;
- estilos institucionais;
- mesclagem de células;
- formato monetário;
- build real do navegador;
- auditoria de vulnerabilidades de produção.

Não reintroduzir ExcelJS oficial ou fork equivalente sem repetir auditoria de vulnerabilidade e teste de compatibilidade com Vite/browser.

## 11. Tratamento de exclusões e confirmações

Fluxos operacionais não devem usar `window.prompt` ou `window.confirm`.

Exclusões que exigem motivo passam pelo host global de solicitação de exclusão:

- `src/lib/deleteRequest.ts`;
- `src/components/admin/DeleteRequestDialogHost.tsx`.

Regras:

- informar claramente a entidade afetada;
- exigir motivo quando o domínio solicitar;
- oferecer cancelar e confirmar;
- bloquear duplo envio;
- registrar usuário, data, hora, ação e motivo quando aplicável;
- respeitar autorização no backend.

## 12. Testes e comandos

### 12.1 Instalação limpa

```bash
npm ci
```

### 12.2 Verificação estrutural

```bash
npm run lint
npm run typecheck:strict
npm run build
```

`lint` executa TypeScript e a auditoria de operação real.

### 12.3 Contratos por domínio

```bash
npm run test:admin
npm run test:client-security
npm run test:provider
npm run test:suppliers
npm run test:travel
npm run test:gsa-store
npm run test:advertising
npm run test:advertising-complete
npm run test:affiliates
npm run test:careers
npm run test:realtime
npm run test:site-campaigns
```

### 12.4 Smoke seguro no navegador

```bash
npx playwright install chromium
npm run test:e2e:smoke
```

A matriz cobre páginas públicas, telas de acesso e rotas protegidas representativas dos portais cliente, empresa, administrativo, prestador, fornecedor e anunciante.

### 12.5 Smoke autenticado de produção

```bash
PRODUCTION_SMOKE=true \
PLAYWRIGHT_BASE_URL=https://dominio-de-producao.example \
PRODUCTION_CLIENT_CPF=00000000000 \
PRODUCTION_CLIENT_PIN=0000 \
npm run test:e2e:production-auth
```

Use somente conta técnica dedicada, com dados mínimos e sem privilégios administrativos. Não execute com cliente real comum. O workflow manual `Authenticated Production Smoke` desativa trace, screenshots e vídeo para não persistir dados pessoais.

### 12.6 Banco

```bash
npm run test:database-migration-baseline
npm run test:database-inventory
```

O inventário completo requer `SUPABASE_DB_URL` protegido.

## 13. Pipelines de CI

O fechamento principal `Production Integrity` executa:

1. instalação limpa;
2. validação dos scripts operacionais;
3. TypeScript e auditoria de operação real;
4. contratos de cliente e Marketplace;
5. contratos de publicidade e Realtime;
6. migrations e autorização administrativa em PostgreSQL temporário;
7. `deno check` de todas as Edge Functions;
8. testes determinísticos Deno;
9. Chromium;
10. smoke público e de proteção;
11. build de produção;
12. upload de evidências sem secrets.

Outros workflows especializados validam Loja, Classificados, Prestadores, Afiliados, Trabalhe Conosco, Publicidade, Colaboradores, Central de Avisos, exportações e dependências.

## 14. Auditoria de operação real

O script `scripts/audit-production-real.mjs` examina código executável em `src` e `supabase/functions` procurando:

- funcionalidade marcada como mock;
- fluxo apenas demonstrativo;
- dado falso/fictício;
- recurso não implementado;
- “em breve” em operação;
- upload simulado;
- prompt em runtime;
- botão vazio;
- link `#`;
- referências artificiais que exigem revisão.

A única exceção específica registrada é o texto intencional “Laboratório de demonstração” no componente de diálogo, que representa uma funcionalidade pública real com esse nome. Não criar exceções genéricas.

No fechamento de 28 de julho de 2026 foram examinados 383 arquivos executáveis, com:

- 0 bloqueadores;
- 0 ocorrências pendentes de revisão.

## 15. Backup e restauração

### 15.1 Banco

```bash
SUPABASE_DB_URL='postgresql://...' npm run backup:database
```

O script:

- exige conexão segura;
- identifica a versão do servidor;
- usa `pg_dump` compatível ou imagem Docker da mesma versão principal;
- gera dump customizado e schema SQL;
- remove arquivos temporários de conexão;
- calcula SHA-256;
- produz `manifest.json`;
- usa permissões restritas.

### 15.2 Storage

```bash
npm run backup:storage
npm run backup:verify-storage
```

### 15.3 Testes de restauração

```bash
npm run restore:test-database
npm run restore:test-storage
```

Backup não é considerado válido sem teste de restauração e conferência dos hashes.

## 16. Variáveis e secrets

Principais grupos:

- `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`: públicas e limitadas por RLS;
- `SUPABASE_DB_URL`: secret operacional;
- `SUPABASE_SERVICE_ROLE_KEY`: apenas backend/CI estritamente controlado;
- origens permitidas de publicidade;
- HMAC de webhooks;
- segredo do scheduler;
- credenciais das integrações financeiras;
- secrets do smoke autenticado.

Nunca registrar valores em logs, relatórios, screenshots, traces ou artefatos.

## 17. Procedimento de desenvolvimento seguro

1. criar branch e worktree exclusivos para a frente;
2. atualizar a branch com a base sem sobrescrever outra frente;
3. limitar o commit aos arquivos do escopo;
4. identificar alterações compartilhadas em rotas, dependências, banco ou configuração;
5. executar TypeScript, auditoria e contratos do domínio;
6. executar build;
7. executar smoke do navegador quando houver interface ou roteamento;
8. revisar diff e secrets;
9. abrir PR em rascunho;
10. somente liberar após evidências verdes.

Não trabalhar diretamente na `main` e não usar sincronização automática entre frentes paralelas.

## 18. Checklist de liberação

### Código

- [ ] `npm ci` concluído;
- [ ] auditoria de dependências sem vulnerabilidade bloqueadora;
- [ ] TypeScript normal e estrito aprovados;
- [ ] auditoria de operação real sem bloqueador;
- [ ] testes do domínio aprovados;
- [ ] build aprovado.

### Banco e backend

- [ ] baseline de migrations aprovado;
- [ ] migrations aplicadas em ordem;
- [ ] inventário de produção atualizado;
- [ ] RLS e políticas revisadas;
- [ ] funções e triggers ativas;
- [ ] buckets e políticas confirmados;
- [ ] Edge Functions verificadas e implantadas;
- [ ] secrets configurados.

### Interface

- [ ] smoke público aprovado;
- [ ] matriz de proteção aprovada;
- [ ] login de conta técnica aprovado;
- [ ] permissões por perfil testadas;
- [ ] estados vazio, carregando e erro verificados;
- [ ] ações destrutivas com confirmação e motivo;
- [ ] responsividade verificada;
- [ ] ausência de erro não tratado no navegador.

### Operação

- [ ] backup recente;
- [ ] restauração testada;
- [ ] monitoramento ativo;
- [ ] plano de rollback definido;
- [ ] evidências anexadas ao PR;
- [ ] aprovação humana final.

## 19. Resposta a incidentes

1. interromper a implantação ou desabilitar a funcionalidade afetada;
2. preservar logs e horários sem copiar dados pessoais desnecessários;
3. identificar commit, migration, função e perfil afetados;
4. revogar tokens ou secrets comprometidos;
5. aplicar correção em branch isolada;
6. validar em ambiente equivalente;
7. executar testes de regressão;
8. restaurar dados somente a partir de backup verificado;
9. documentar causa raiz e prevenção;
10. acompanhar o ambiente após a correção.

## 20. Limites da evidência atual

O fechamento automatizado comprova o comportamento coberto pelos testes, contratos e inventários executados. Ele não comprova sozinho:

- disponibilidade futura de serviços externos;
- correção de dados inseridos manualmente após a execução;
- configuração de secrets não acessíveis ao PR;
- estado de produção posterior ao inventário;
- todos os caminhos possíveis de cada usuário;
- experiência visual em todos os dispositivos físicos.

A declaração “zero falhas” só pode ser feita para o escopo e o instante efetivamente testados. Para produção, o último passo obrigatório é executar o smoke autenticado com contas técnicas de cada perfil e atualizar o inventário do banco no ambiente real.
