# Relatório de Auditoria Front-End: Painéis de Prestador, Parceiro, Fornecedor, Colaborador, Afiliado e Anunciante

**Data**: 2026-09-11  
**Auditor**: Teamwork Explorer (Front-end QA & Security Auditor)  
**Escopo**: Auditoria exaustiva de Front-End nos 6 ecossistemas de papéis do Grupo GSA (`Prestador`, `Parceiro`, `Fornecedor`, `Colaborador`, `Afiliado`, `Anunciante`), abrangendo componentes React, rotas, segurança de navegação, ciclo de vida de hooks, validação de formulários, sincronização com schema do banco de dados (Supabase) e código órfão/morto.

---

## 1. Observation (Observações Diretas e Evidências Verbatim)

### 1.1 Compilação e Tipagem TypeScript
- **Comando**: `npx tsc --noEmit`
- **Resultado**: Código de saída `0`. Zero erros de compilação ou checagem estática no TypeScript em todo o repositório.

---

### 1.2 Anunciante: Bloqueio Crítico de Acesso ao Portal (Lockout)
- **Arquivo**: `src/routes/routeSecurity.ts`, linhas 32–34:
  ```typescript
  if (area === 'advertiser') {
    return Boolean(session.clientId) || Boolean(session.adminAuth);
  }
  ```
- **Arquivo**: `src/App.tsx`, linhas 430–456:
  ```typescript
  const isAdvertiserModule = currentModule === 'anunciante';
  ...
  const allowed = isAdvertiserModule
    ? canAccessArea('advertiser', { clientId: clientAuth.session?.clientId, adminAuth })
    : ...
  if (!allowed) {
    navigateTo('/login');
    return;
  }
  ```
- **Evidência**: No arquivo `src/routes/routeCatalog.ts`, a rota `/anuncios/login` e `/anuncios` possuem `area: 'advertiser'`. Quando um anunciante não autenticado tenta acessar o portal em `/anuncios/login` ou `/anuncios`, `session.clientId` é `undefined` e `session.adminAuth` é `false`. 
- **Efeito**: `canAccessArea('advertiser', ...)` retorna estritamente `false`. O `App.tsx` força o redirecionamento imediato para `/login` (portal geral de clientes), tornando a tela de login de anunciantes (`src/pages/AdvertiserPortal.tsx`) **100% inacessível** para novos anunciantes ou anunciantes deslogados.

---

### 1.3 Prestador: Quebra de Execução SQL em Extrato Financeiro
- **Arquivo**: `src/components/prestador/PrestadorFinanceiro.tsx`, linhas 197–201:
  ```typescript
  const { data: pData } = await supabase
    .from('prestadores')
    .select('nome_completo, telefone')
    .eq('id', prestadorId)
    .single();
  ```
- **Evidência no Banco de Dados**: No arquivo de migração `supabase/migrations/20260317000002_create_prestadores_schema.sql` (e em `20260317000001_create_prestadores_tables.sql`):
  ```sql
  CREATE TABLE IF NOT EXISTS prestadores (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nome_razao TEXT NOT NULL,
      nome_responsavel TEXT,
      tipo_pessoa TEXT NOT NULL CHECK (tipo_pessoa IN ('PF', 'PJ')),
      cpf_cnpj TEXT NOT NULL,
      telefone TEXT NOT NULL,
      email TEXT NOT NULL,
      ...
  );
  ```
  A coluna `nome_completo` **não existe** na tabela `prestadores`.
- **Efeito**: Ao clicar no botão "Enviar WhatsApp" para gerar o PDF e enviar o extrato financeiro, a chamada PostgREST falha com o erro PostgreSQL `column prestadores.nome_completo does not exist` (PGRST204 / 42703). A linha 245 dispara `toast.error('Erro ao gerar extrato.')`, quebrando a funcionalidade de geração de extrato financeiro do prestador.

---

### 1.4 Prestador: Rota Órfã no Catálogo e no Dashboard
- **Arquivo**: `src/components/prestador/PrestadorDashboard.tsx`, linha 150:
  ```typescript
  { id: 'perfil', label: 'Meu Perfil', icon: User, path: '/prestador/perfil' }
  ```
- **Arquivo**: `src/routes/routeCatalog.ts`, linhas 344–364:
  O objeto `routes.provider` define `root`, `login`, `register`, `access`, `dashboard`, `orders`, `financial`, `schedule`, `documents`, `support`, `vouchers`, `rewards`, `promotions`.
  Não existe `routes.provider.profile` nem mapeamento canônico de `/prestador/perfil`.

---

### 1.5 Prestador: Etapa de Sucesso Faltante no Formulário de Cadastro
- **Arquivo**: `src/pages/ProviderAccessPage.tsx`:
  - Linha 108: `const [registrationStage, setRegistrationStage] = useState<'form' | 'whatsapp' | 'setup_pin' | 'success'>('form');`
  - Linhas 251–278 (`submitFinalRegistration`):
    ```typescript
    const result = await completeProviderRegistration(providerId, pin);
    if (!result.success) {
      toast.error(result.error || 'Erro ao definir PIN.');
      return;
    }
    toast.success('Cadastro finalizado com sucesso!');
    // Não executa setRegistrationStage('success')
    ```
  - Linhas 751–770: No bloco de renderização condicional do formulário, existem blocos apenas para:
    `{registrationStage === 'form' && ...}`
    `{registrationStage === 'whatsapp' && ...}`
    `{registrationStage === 'setup_pin' && ...}`
    **Não existe nenhum bloco condicional para `{registrationStage === 'success' && ...}`.**
- **Efeito**: O estado `'success'` foi planejado mas nunca implementado na UI, deixando o usuário preso no formulário de criação de PIN sem transição visual explícita de boas-vindas/conclusão de credenciamento.

---

### 1.6 Parceiro & Fornecedor: Desconexão Arquitetural e Código Órfão Massivo
- **Arquivo**: `src/components/admin/super-domains/pessoas/FornecedoresSection.tsx` (tamanho: 102 KB, 2.052 linhas):
  Contém o fluxo completo de gestão de benefícios de parceiros, aprovação de vouchers, upload de comprovantes fiscais e auditoria de contestações:
  - Importa `PartnerRedemptionDetailModal.tsx`.
  - Implementa `handleOpenRedemptionDetail`, `handleRedemptionStatusChange`, `handleApproveWithEvidence`, `handleDisputeResolution`.
- **Arquivo**: `src/components/admin/AdminPanel.tsx`, linhas 258–260:
  ```typescript
  {currentSection === 'fornecedores' && <FornecedoresModule />}
  {currentSection === 'parceiros' && <PartnersAdminModule />}
  ```
  - `AdminPanel.tsx` roteia `/admin/fornecedores` para `FornecedoresModule.tsx` (que possui apenas CRUD simples de fornecedores) e `/admin/parceiros` para `PartnersAdminModule.tsx` (que faz apenas triagem de adesão de parceiros e lista cadastral).
  - Nem `FornecedoresModule` nem `PartnersAdminModule` importam `PartnerRedemptionDetailModal.tsx` nem oferecem moderação de vouchers resgatados.
  - O super domínio `PessoasSuperDomain.tsx` (que encapsula `FornecedoresSection.tsx`, `PrestadoresSection.tsx`, `SaquesRepassesSection.tsx`, `AfiliadosSection.tsx`) **nunca é instanciado no `AdminPanel.tsx` ou em `App.tsx`**.
- **Outros componentes órfãos confirmados**:
  - `src/components/admin/PrestadoresModule.tsx` (142 linhas) — completamente órfão.
  - `src/components/admin/prestadores/PrestadoresDemandas.tsx` (159 KB, 3.015 linhas) — completamente órfão.

---

### 1.7 Falhas Silenciosas em Operações Assíncronas (Swallowed Promises)
- **Arquivo**: `src/features/partners/service.ts`, linha 313:
  ```typescript
  void sendAdminWhatsAppNotification({
    title: 'Nova Solicitação de Parceria',
    message: `Empresa: ${input.business_name} (${input.contact_name})`,
    protocol: record.protocol,
  }).catch(() => {});
  ```
  O erro de notificação externa é engolido silenciosamente com catch vazio `() => {}`, sem log no console e sem persistência de falha no histórico do protocolo.
- **Arquivo**: `src/components/prestador/PrestadorDemandas.tsx`, linhas 135–142 (`loadHistory`):
  ```typescript
  const loadHistory = async (demandaId: string) => {
    const { data, error } = await supabase
      .from('prestador_demandas_historico')
      .select('*')
      .eq('demanda_id', demandaId)
      .order('created_at', { ascending: true });
    if (error) {
      return; // Falha silenciosa, sem toast e sem feedback de erro ao prestador
    }
    setHistory(data || []);
  };
  ```

---

### 1.8 Ausência de Realtime e Sobrecarga de Assinaturas WebSocket
- **Arquivo**: `src/components/afiliado/AfiliadoDashboard.tsx`:
  Não implementa hook de realtime (`useRealtimeSubscription` ou `supabase.channel`). Ao contrário do `ClientAffiliatePanel.tsx` (que escuta alterações em tempo real), o `AfiliadoDashboard` depende de recarregamento manual da página para refletir novos saques, comissões aprovadas ou saldo de pontos.
- **Arquivo**: `src/components/admin/prestadores/PrestadoresFinanceiro.tsx`, linhas 65–86:
  ```typescript
  useEffect(() => {
    fetchTransacoes();
    const channel = supabase.channel('prestadores_financeiro_realtime')
      .on('postgres_changes', ...)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [filterStatus, filterPrestador, dateRange, searchTerm]);
  ```
  O canal WebSocket é destruído e recriado a cada caractere digitado no campo de busca (`searchTerm`), gerando tempestade de inscrições/cancelamentos no gateway Realtime do Supabase.
- **Componentes do Prestador (`Prestador*.tsx`)**:
  Os 8 subcomponentes (`PrestadorDemandas`, `PrestadorFinanceiro`, `PrestadorAgenda`, `PrestadorDocumentos`, `PrestadorSuporte`, `PrestadorVouchers`, `PrestadorPremios`, `PrestadorPromocoes`) instanciam `supabase.channel` diretamente em vez de utilizar o hook padronizado `useRealtimeSubscription`.

---

### 1.9 Artefato de Codificação / Typo em JSX
- **Arquivo**: `src/components/admin/super-domains/pessoas/FornecedoresSection.tsx`, linha 607:
  ```tsx
  {row.nome_fantasia ? `${row.nome_fantasia} \" ` : ''}CNPJ: ...
  ```
  Contém aspas escapadas incorretamente (`\" `) em vez de um separador limpo (como ` • `).

---

## 2. Logic Chain (Cadeia de Raciocínio Dedutivo)

1. **Raciocínio da Inacessibilidade do Portal de Anúncios (Anunciante Lockout)**:
   - *Premissa 1*: O arquivo `routeSecurity.ts:33` estipula que a área `'advertiser'` requer `session.clientId` ou `session.adminAuth`.
   - *Premissa 2*: Um anunciante externo não é necessariamente um cliente corporativo padrão (`clientId`) e não possui sessão de administrador (`adminAuth`). Ele acessa via `/anuncios/login`.
   - *Premissa 3*: Em `App.tsx:442`, a verificação `canAccessArea('advertiser', ...)` é disparada antes de renderizar `AdvertiserPortal`.
   - *Dedução*: Como o anunciante não tem `clientId` antes de logar, a função retorna `false` e `App.tsx` executa `navigateTo('/login')`. Portanto, o portal de anúncios está completamente bloqueado para usuários não autenticados que tentam fazer login.

2. **Raciocínio do Erro de Banco no Extrato do Prestador**:
   - *Premissa 1*: `PrestadorFinanceiro.tsx:198` executa `.select('nome_completo, telefone')` contra a tabela `prestadores`.
   - *Premissa 2*: O schema DDL da tabela `prestadores` (migração `20260317000002_create_prestadores_schema.sql`) define `nome_razao` e `nome_responsavel`, e não possui a coluna `nome_completo`.
   - *Premissa 3*: O PostgREST do Supabase valida o schema da query estritamente e lança código 42703 se uma coluna inexistente for requisitada.
   - *Dedução*: Toda tentativa do prestador de emitir extrato financeiro para WhatsApp resulta em rejeição da promise, caindo no bloco `catch` e exibindo mensagem de erro ao usuário.

3. **Raciocínio da Fratura de UX no Cadastro de Prestador**:
   - *Premissa 1*: O estado `registrationStage` inclui `'success'`, mas `submitFinalRegistration` não o define e o JSX não o contempla.
   - *Dedução*: Há uma discrepância entre o design pretendido (uma tela/modal de confirmação de cadastro aprovado ou em análise) e a implementação final, gerando sensação de instabilidade ou congelamento da interface para o novo prestador.

4. **Raciocínio da Perda de Funcionalidade no Painel Admin (Fornecedores & Parceiros)**:
   - *Premissa 1*: Uma rica interface de auditoria de resgates de benefícios de parceiros foi desenvolvida em `FornecedoresSection.tsx` e `PartnerRedemptionDetailModal.tsx`.
   - *Premissa 2*: Os componentes conectados ao menu principal do `AdminPanel.tsx` são `FornecedoresModule.tsx` e `PartnersAdminModule.tsx`.
   - *Dedução*: O código de `FornecedoresSection.tsx` (102 KB) e `PessoasSuperDomain.tsx` tornou-se código morto (dead code funcional), privando os administradores de auditar vouchers de benefícios, aplicar glosas ou resolver disputas com parceiros.

5. **Raciocínio da Instabilidade de Conexão WebSocket no Financeiro**:
   - *Premissa 1*: O hook `useEffect` em `PrestadoresFinanceiro.tsx:86` inclui `searchTerm` na sua lista de dependências.
   - *Premissa 2*: A cada digitação do usuário no campo de busca, o cleanup do effect executa `supabase.removeChannel(channel)` e uma nova conexão WebSocket é negociada.
   - *Dedução*: Isso consome largura de banda excessiva, degrada a performance da UI e pode disparar limite de conexões simultâneas (rate limiting) na infraestrutura Supabase Realtime.

---

## 3. Caveats (Limitações e Hipóteses)

1. **Auditoria Estritamente Read-Only**: Nenhuma alteração foi gravada em arquivos de produção durante esta auditoria. Todas as correções propostas foram validadas conceitualmente contra as migrações SQL e a árvore de componentes.
2. **Integrações Externas (Evolution API / n8n / WhatsApp)**: Os webhooks externos foram analisados do ponto de vista do contrato no front-end (`src/services/` e `src/features/partners/service.ts`). O comportamento dos servidores upstream externos não foi auditado diretamente por se tratar de serviço fora do repositório local.
3. **Módulos Super Domains vs. Módulos Tradicionais**: A coexistência de `src/components/admin/super-domains/` com `src/components/admin/*Module.tsx` indica uma refatoração arquitetural iniciada mas não concluída no painel administrativo.

---

## 4. Conclusion & Action Plan (Plano de Ação e Propostas de Código)

Abaixo está o plano de ação priorizado com os patches de correção recomendados:

```
+----------+------------------------------------+------------+------------------------------------------+
| Nível    | Módulo / Painel                    | Arquivo    | Problema Principal                       |
+----------+------------------------------------+------------+------------------------------------------+
| P0       | Anunciante                         | routeSec.  | Bloqueio total de acesso ao login        |
| P0       | Prestador                          | Financeiro | Query SQL busca coluna inexistente       |
| P1       | Prestador                          | AccessPage | Estágio 'success' não renderizado        |
| P1       | Parceiro / Admin                   | AdminPanel | Auditoria de vouchers inacessível        |
| P1       | Prestador                          | Catalog    | Rota de perfil ausente no catálogo       |
| P2       | Parceiro / Prestador / Afiliado    | Vários     | Falhas assíncronas silenciosas / Realtime|
+----------+------------------------------------+------------+------------------------------------------+
```

### 4.1 Proposta de Correção P0: Desbloqueio do Portal de Anunciantes
**Arquivo**: `src/routes/routeSecurity.ts`
```diff
--- a/src/routes/routeSecurity.ts
+++ b/src/routes/routeSecurity.ts
@@ -32,3 +32,5 @@ export function canAccessArea(area: RouteArea, session: RouteSessionContext): bo
   if (area === 'advertiser') {
-    return Boolean(session.clientId) || Boolean(session.adminAuth);
+    // O portal de anúncios gerencia sua própria autenticação ou acesso público à tela de login/protocolo
+    return true;
   }
```
*Rationale*: O componente `AdvertiserPortal.tsx` já implementa seu próprio estado de sessão e verificação de autenticação internamente (via Supabase Auth / protocolo de anunciante). O `canAccessArea` não deve barrar usuários antes que eles possam interagir com o portal de anúncios.

---

### 4.2 Proposta de Correção P0: Correção do Schema SQL no Extrato do Prestador
**Arquivo**: `src/components/prestador/PrestadorFinanceiro.tsx`
```diff
--- a/src/components/prestador/PrestadorFinanceiro.tsx
+++ b/src/components/prestador/PrestadorFinanceiro.tsx
@@ -197,3 +197,3 @@ export const PrestadorFinanceiro: React.FC<PrestadorFinanceiroProps> = ({ presta
       const { data: pData } = await supabase
         .from('prestadores')
-        .select('nome_completo, telefone')
+        .select('nome_razao, telefone')
         .eq('id', prestadorId)
         .single();
@@ -213,3 +213,3 @@ export const PrestadorFinanceiro: React.FC<PrestadorFinanceiroProps> = ({ presta
       const pdfBlob = await generateExtratoPDF({
-        prestadorNome: pData?.nome_completo || 'Prestador',
+        prestadorNome: pData?.nome_razao || 'Prestador',
         prestadorTelefone: pData?.telefone || '',
```
*Rationale*: Alinha o select com a coluna `nome_razao` existente no schema oficial da tabela `prestadores`.

---

### 4.3 Proposta de Correção P1: Registro de Rota no `routeCatalog.ts`
**Arquivo**: `src/routes/routeCatalog.ts`
```diff
--- a/src/routes/routeCatalog.ts
+++ b/src/routes/routeCatalog.ts
@@ -350,2 +350,3 @@ export const routes = {
     dashboard: '/prestador/dashboard',
+    profile: '/prestador/perfil',
     orders: '/prestador/demandas',
```

---

### 4.4 Proposta de Correção P1: Conclusão do Fluxo de Sucesso no Credenciamento de Prestador
**Arquivo**: `src/pages/ProviderAccessPage.tsx`
- Adicionar chamada `setRegistrationStage('success')` após `completeProviderRegistration`.
- Renderizar cartão de sucesso com botão de redirecionamento para `setStep('login')` e mensagem instruindo o prestador a aguardar validação documental ou efetuar o primeiro acesso com o PIN cadastrado.

---

### 4.5 Proposta de Correção P1: Integração de Moderação de Vouchers no Painel Admin
**Arquivo**: `src/components/admin/PartnersAdminModule.tsx`
- Importar `PartnerRedemptionDetailModal.tsx` e disponibilizar aba ou botão na tabela de parceiros para visualizar os resgates (`partner_benefit_redemptions`) emitidos para clientes e prestadores do Grupo GSA.

---

### 4.6 Proposta de Correção P2: Otimização de Assinatura WebSocket e Debounce
**Arquivo**: `src/components/admin/prestadores/PrestadoresFinanceiro.tsx`
- Remover `searchTerm` da lista de dependências do `useEffect` do canal WebSocket.
- Efetuar a filtragem por `searchTerm` client-side ou com debounce sem recriar o canal WebSocket a cada tecla.

---

### 4.7 Proposta de Correção P2: Logging em `service.ts` de Parceiros
**Arquivo**: `src/features/partners/service.ts`
```diff
--- a/src/features/partners/service.ts
+++ b/src/features/partners/service.ts
@@ -313,1 +313,3 @@ export async function submitPartnerApplication(input: PartnerApplicationInput)
-    void sendAdminWhatsAppNotification({ ... }).catch(() => {});
+    void sendAdminWhatsAppNotification({ ... }).catch((err) => {
+      console.warn('[PartnersService] Falha ao despachar notificação WhatsApp para admin:', err);
+    });
```

---

## 5. Verification Method (Método de Verificação Independente)

Para reproduzir e auditar de forma independente os apontamentos deste relatório:

1. **Checagem Estática de Tipos**:
   ```powershell
   npx tsc --noEmit
   ```
   *Resultado esperado*: 0 erros.

2. **Verificação do Bloqueio de Anunciante**:
   - Inspecione `src/routes/routeSecurity.ts` linha 33.
   - Simule a rota `/anuncios/login` com sessão vazia `{ clientId: undefined, adminAuth: false }`.
   - Observe que `canAccessArea('advertiser', ...)` retorna `false`, disparando o redirect em `App.tsx:445`.

3. **Verificação da Inconsistência de Coluna na Tabela `prestadores`**:
   - Inspecione `src/components/prestador/PrestadorFinanceiro.tsx` linha 198.
   - Compare com a migração `supabase/migrations/20260317000002_create_prestadores_schema.sql` linha 12: constate que o campo é `nome_razao` e não `nome_completo`.

4. **Verificação do Componente Órfão de Resgates de Parceiros**:
   - Inspecione `src/components/admin/super-domains/pessoas/FornecedoresSection.tsx`.
   - Execute busca por referências em arquivos ativos fora de sua própria pasta:
     ```powershell
     rg "FornecedoresSection" src/
     ```
     Constata-se que nenhum módulo ativo em `AdminPanel.tsx` ou `App.tsx` o importa.
