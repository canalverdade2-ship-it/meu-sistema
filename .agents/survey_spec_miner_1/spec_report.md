# Relatório de Especificação Técnica: Fluxo de Resgate de Benefícios de Parceiros (Web & Service Layer)

**Data de Elaboração:** 27 de Agosto de 2026  
**Agente:** `survey_spec_miner_1`  
**Escopo:** Mapeamento minucioso do fluxo web, componentes de interface, camada de serviço TypeScript, chamadas Supabase RPC, estrutura de banco de dados (`parceiros`, `parceiros_resgates`), tratamento de duplicidade, override com justificativa, regras de SLA (24h/48h), tipos de parceiros e entrega de benefícios.

---

## 1. Visão Geral e Fontes Autoritativas Inspecionadas

As especificações documentadas neste relatório foram extraídas diretamente do código-fonte autoritativo do projeto:
1. **Frontend / Componentes React:**
   - `src/components/public/PartnerBenefitRedeemModal.tsx` (Formulário de resgate, interceptação de duplicidade com justificativa, telas de sucesso 24h e imediata).
   - `src/components/public/PartnersPage.tsx` (Vitrine de parceiros e acionamento do modal).
   - `src/components/admin/super-domains/pessoas/PartnerRedemptionDetailModal.tsx` (Gestão administrativa de resgates, contagem regressiva de SLA 24h em tempo real, aprovação, recusa com motivo e emissão de link de ativação).
   - `src/components/admin/PartnersAdminModule.tsx` (Módulo administrativo de parceiros e listagem de solicitações).
2. **Camada de Serviço TypeScript:**
   - `src/features/partners/service.ts` (`redeemPartnerBenefit`, `checkDuplicateRedemption`, `completePartnerRedemption`, `approveRedemption`, `rejectRedemption`, `consultarProtocolo`, `listPartnerRedemptions`, `savePartner`).
   - `src/features/partners/types.ts` (`Partner`, `PartnerBenefitRedemptionPayload`, `PartnerBenefitRedemptionResult`, `PartnerRedemption`, `ProtocolConsultResult`).
3. **Banco de Dados & RPCs Supabase:**
   - `supabase/migrations/20260721120000_partner_benefit_redemption.sql`
   - `supabase/migrations/20260826150000_partner_redemption_email_and_sla.sql`
   - `supabase/migrations/20260826153000_partner_delay_24h_toggle.sql`
   - `supabase/migrations/20260826160000_admin_list_partner_redemptions_rpc.sql`
   - `supabase/migrations/20260826161500_partner_redemption_protocol.sql`
   - `supabase/migrations/20260826190000_consolidate_partner_redemption_system.sql`
   - `supabase/migrations/20260826220000_production_remediation_consolidated.sql`
   - `supabase/migrations/20260827180000_public_protocol_consultation.sql`
   - `supabase/migrations/20260827200000_add_data_cancelamento_to_parceiros_resgates.sql`
4. **Suíte de Testes Automatizados:**
   - `src/tests/partner-public-redemption-rpc.test.ts`
   - `src/tests/partner-redemption-edge-cases.test.ts`
   - `src/tests/adversarial-business-logic-challenger.test.ts`
   - `src/tests/empirical-stress-partner-whatsapp.test.ts`

---

## 2. Fluxo Completo de Resgate no Sistema Web

O fluxo de resgate no sistema web é composto pelas seguintes etapas interativas e assíncronas:

```
[ Vitrine / PartnersPage ] 
           │
           ▼ (Clica em "Resgatar Benefício")
[ PartnerBenefitRedeemModal: Tela 1 - Formulário ]
           │
           │  (Digita Nome, E-mail, Telefone/WhatsApp)
           ▼  (Clica em "Resgatar Benefício")
[ Pré-validação Frontend & Sanitização ]
           │
           ▼
[ service.ts: redeemPartnerBenefit ]
           │
           ├──► [ checkDuplicateRedemption (se forceOverride = false) ]
           │         │
           │         ├─► Se duplicado: Lança Error HTTP 409
           │         │         │
           │         │         ▼
           │         │   [ Modal: Tela 1B - Popup de Duplicidade ]
           │         │         │ (Usuário digita Justificativa textual)
           │         │         ▼ (Clica em "Enviar Solicitação")
           │         │   [ Reenvia com forceOverride=true e justificativaDuplicidade ]
           │         │
           │         └─► Se não duplicado: Prossegue
           │
           ▼
[ RPC: gsa_public_resgatar_beneficio_parceiro ]
           │
           ├─► Valida nome e telefone (DDD válido)
           ├─► Localiza parceiro ativo por id/slug
           ├─► Gera protocolo canônico PROT-RES-YYYY-XXXXXX
           ├─► Determina tipo_resgate (cupom, voucher, combinado, manual_24h, link)
           ├─► Insere em parceiros_resgates com status='pendente'
           └─► Retorna JSON com dados do resgate e configurações do parceiro
           │
           ▼
[ service.ts: Pós-processamento ]
           │
           ├──► Se forceOverride=true:
           │       UPDATE parceiros_resgates SET alerta_duplicidade=true, 
           │              justificativa_duplicidade=..., status='analise'
           │
           ├──► Garante persistência de codigo_gerado e email
           │
           └──► Disparo de Notificações WhatsApp:
                   ├─► Se SLA 24h / Análise:
                   │     1. WhatsApp para o Cliente (Confirmação com protocolo e prazo)
                   │     2. WhatsApp Alerta para Admin Master (5511971858372)
                   │
                   └─► Se Liberação Imediata:
                         1. WhatsApp para o Cliente (Cupom/Link direto + Protocolo)
           │
           ▼
[ Modal: Tela 2 - Sucesso ]
           ├─► Tela 2A (SLA 24h ou status='analise'):
           │     • Cronômetro / Etapas coloridas (1. Registrado, 2. Emissão 24h/48h, 3. WhatsApp)
           │     • Card com Protocolo Oficial copiável
           │     • Botão "Entendido — Concluir" redireciona para /consulta-protocolo?codigo=...
           │
           └─► Tela 2B (Liberação Imediata):
                 • Código de Cupom com botão Copiar
                 • Botão de Acesso ao Site do Parceiro
                 • Instruções de uso ("Como Utilizar")
                 • Aviso de confirmação enviada ao WhatsApp
```

### 2.1 Detalhamento dos Campos e Validações no Formulário
- **Nome Completo (`nomeCompleto`)**:
  - Validação Frontend: `trimmedNome.length >= 3`.
  - Validação Backend RPC: `length(v_nome) >= 2`.
  - Validação NLU/Webhook: exige ao menos nome e sobrenome (`parts.length >= 2`).
- **E-mail (`email`)**:
  - Validação Frontend: Expressão regular `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.
  - Resiliência na Camada de Serviço: `email.trim()` enviado como `p_email`; se ausente, enviado como `null`.
- **Telefone / WhatsApp com DDD (`telefone`)**:
  - Máscara Frontend: `(00) 00000-0000` / `(00) 0000-0000` via `maskPhone`.
  - Validação Frontend: Dígitos numéricos limpos `cleanPhone.length >= 10`.
  - Validação Backend RPC: `regexp_replace(v_telefone, '\D', '', 'g')` com `length >= 10`.
  - Sanitização Webhook: Prefixo internacional `55` adicionado caso não informado.

---

## 3. Parâmetros Exatos Enviados às Funções Backend / RPC / Tabelas

### 3.1 Interface TypeScript do Payload (`PartnerBenefitRedemptionPayload`)
```typescript
export interface PartnerBenefitRedemptionPayload {
  parceiroId?: string;               // UUID do parceiro (opcional se parceiroSlug fornecido)
  parceiroSlug?: string;             // Slug do parceiro (ex: 'petlove', 'drogasil')
  nomeCompleto: string;              // Nome completo do titular solicitante
  email?: string;                    // E-mail para contato e auditoria
  telefone: string;                  // Telefone/WhatsApp com DDD
  clienteId?: string;                // UUID do cliente autenticado (opcional)
  justificativaDuplicidade?: string; // Texto explicativo em caso de re-solicitação
  alertaDuplicidade?: boolean;       // Flag indicadora de duplicidade
  forceOverride?: boolean;           // Flag para forçar inserção sob análise
}
```

### 3.2 Assinatura Canônica da RPC Supabase (`gsa_public_resgatar_beneficio_parceiro`)
```sql
FUNCTION public.gsa_public_resgatar_beneficio_parceiro(
  p_parceiro_id   uuid DEFAULT NULL,
  p_parceiro_slug text DEFAULT NULL,
  p_nome_completo text DEFAULT NULL,
  p_telefone      text DEFAULT NULL,
  p_cliente_id    uuid DEFAULT NULL,
  p_email         text DEFAULT NULL
)
RETURNS jsonb
```

#### Parâmetros enviados pelo cliente via `supabase.rpc`:
| Parâmetro RPC | Tipo PostgreSQL | Origem / Valor | Obrigatório |
|---|---|---|---|
| `p_parceiro_id` | `uuid` | `payload.parceiroId \|\| null` | Não (se slug existir) |
| `p_parceiro_slug` | `text` | `payload.parceiroSlug \|\| null` | Não (se id existir) |
| `p_nome_completo` | `text` | `payload.nomeCompleto.trim()` | Sim |
| `p_telefone` | `text` | `payload.telefone.trim()` | Sim |
| `p_cliente_id` | `uuid` | `payload.clienteId \|\| null` | Não |
| `p_email` | `text` | `payload.email.trim() \|\| null` | Não |

*Observação de Compatibilidade:* O serviço `service.ts` implementa fallback automático: se o backend retornar erro `PGRST202` (incompatibilidade de sobrecarga com 5 parâmetros sem `p_email`), a requisição é automaticamente repetida sem a chave `p_email`.

### 3.3 Estrutura de Tabelas Envolvidas

#### Tabela `public.parceiros` (Configurações do Parceiro):
- `id` (`uuid`, PK)
- `slug` (`text`, Unique)
- `name` (`text`)
- `category` (`text`)
- `benefits` (`text`)
- `website` (`text`)
- `logo_url` (`text`)
- `cover_url` (`text`)
- `status` (`text`: `'ativo'`, `'inativo'`, `'em_analise'`, `'encerrado'`, `'excluido'`)
- `redemption_has_coupon` (`boolean`, default `false`)
- `redemption_coupon_code` (`text`, código fixo configurado na parceria)
- `redemption_has_voucher` (`boolean`, default `false`)
- `redemption_has_link` (`boolean`, default `false`)
- `redemption_link` (`text`, URL direta de resgate / ativação)
- `redemption_auto_redirect` (`boolean`, default `false`)
- `redemption_instructions` (`text`, guia de utilização)
- `redemption_delay_24h` (`boolean`, default `false`, define se requer aprovação/ativação em 24h)

#### Tabela `public.parceiros_resgates` (Registros de Resgate e Leads):
- `id` (`uuid`, PK, `gen_random_uuid()`)
- `parceiro_id` (`uuid`, FK `parceiros.id` ON DELETE CASCADE)
- `cliente_id` (`uuid`, FK opcional para `clientes.id`)
- `nome_completo` (`text`, NOT NULL)
- `telefone` (`text`, NOT NULL)
- `email` (`text`, nullable)
- `codigo_gerado` (`text`, protocolo `PROT-RES-YYYY-XXXXXX` ou cupom)
- `tipo_resgate` (`text`: `'cupom'`, `'voucher'`, `'link'`, `'combinado'`, `'manual_24h'`)
- `link_destino` (`text`, link original do parceiro)
- `link_ativacao` (`text`, link gerado individualmente pelo admin)
- `cupom` (`text`, cupom atribuído administrativamente)
- `voucher` (`text`, voucher atribuído administrativamente)
- `status` (`text`, default `'pendente'`: `'pendente'`, `'analise'`, `'concluido'`, `'recusado'`, `'cancelado'`)
- `alerta_duplicidade` (`boolean`, default `false`)
- `justificativa_duplicidade` (`text`, nullable)
- `motivo_recusa` (`text`, nullable)
- `auto_redirecionado` (`boolean`, default `false`)
- `created_at` (`timestamptz`, default `now()`)
- `data_ativacao` (`timestamptz`, nullable)
- `data_cancelamento` (`timestamptz`, nullable)

---

## 4. Detecção de Duplicidade, Justificativa e Máquina de Estados

### 4.1 Mecanismo de Detecção de Duplicidade (`checkDuplicateRedemption`)
Antes de chamar a RPC de criação (quando `forceOverride = false`), o sistema verifica a existência de resgates prévios:
```typescript
export async function checkDuplicateRedemption(
  parceiroId: string, 
  email?: string, 
  telefone?: string
): Promise<boolean> {
  if (!parceiroId || (!email && !telefone)) return false;

  let query = supabase
    .from('parceiros_resgates')
    .select('id')
    .eq('parceiro_id', parceiroId)
    .neq('status', 'recusado'); // Resgates recusados NÃO bloqueiam nova solicitação

  if (email && telefone) {
    query = query.or(`email.eq.${email},telefone.eq.${telefone}`);
  } else if (email) {
    query = query.eq('email', email);
  } else if (telefone) {
    query = query.eq('telefone', telefone);
  }

  const { data, error } = await query.limit(1);
  return data && data.length > 0;
}
```

### 4.2 Resposta de Erro HTTP 409
Se a consulta encontrar registros prévios:
1. `service.ts` instancia e lança o erro:
   ```javascript
   const error = new Error('409 - Duplicidade: Cliente já possui um resgate para este parceiro.');
   error.status = 409;
   throw error;
   ```
2. O modal web captura o erro no bloco `catch`:
   - Checa `err?.status === 409 || err?.code === '409' || err?.message?.includes('409') || err?.message?.includes('duplicidade') || err?.message?.includes('já resgatou')`.
   - Abre o estado visual `showDuplicatePopup = true`.

### 4.3 Fluxo de Justificativa e `forceOverride`
1. O usuário é apresentado com a tela de justificativa informando que já possui um resgate anterior.
2. O usuário preenche o campo de texto obrigatório `justificativa`.
3. Ao submeter, o modal invoca `redeemPartnerBenefit` com:
   - `justificativaDuplicidade: justificativa`
   - `forceOverride: true`
4. Na camada de serviço:
   - A verificação preliminar `checkDuplicateRedemption` é ignorada (`if (!payload.forceOverride)`).
   - A RPC insere o resgate normalmente gerando o ID e o protocolo.
   - O serviço executa um `UPDATE` imediato na tabela `parceiros_resgates`:
     ```sql
     UPDATE public.parceiros_resgates
        SET alerta_duplicidade = true,
            justificativa_duplicidade = payload.justificativaDuplicidade,
            status = 'analise'
      WHERE id = result.resgate_id;
     ```
   - O objeto de retorno tem seu status atualizado para `status: 'analise'`.

### 4.4 Estados do Resgate (`parceiros_resgates.status`)
| Status | Significado | Próxima Ação Permitida | Notificação Disparada |
|---|---|---|---|
| `pendente` | Resgate regular em parceiro com `redemption_delay_24h = true`. Aguardando admin gerar link de ativação. | Admin aprovar ou inserir link de ativação (`completePartnerRedemption`) | WhatsApp ao Cliente (SLA 24h) + WhatsApp ao Admin |
| `analise` | Resgate duplicado com justificativa (`forceOverride = true`). Requer avaliação da gerência. | Admin pode **Aprovar** (`approveRedemption` -> muda para `pendente`) ou **Recusar** (`rejectRedemption` -> muda para `recusado`). | WhatsApp ao Cliente (SLA 48h) + WhatsApp ao Admin |
| `concluido` | Benefício liberado (imediatamente ou após inserção de link de ativação/cupom pelo admin). | Admin pode reenviar WhatsApp de ativação. | WhatsApp ao Cliente com Link / Cupom Oficial |
| `recusado` | Solicitação recusada pelo administrador com justificativa registrada em `motivo_recusa`. | Não gera benefício. Libera o cliente para solicitar novamente no futuro. | WhatsApp ao Cliente com o motivo da recusa |
| `cancelado` | Cancelado a pedido do próprio cliente (via autoatendimento WhatsApp) com registro em `data_cancelamento`. | Estado final. Não aceita alterações. | WhatsApp de confirmação de cancelamento + Alerta ao Admin |

---

## 5. Regras de SLA, Lógica `delay_24h` e Tipos de Parceiros

### 5.1 Critérios de Determinação de Modo 24h (`isDelay24h`)
O sistema avalia se a solicitação deve operar no modo assíncrono (SLA 24h / Análise 48h) através da seguinte expressão booleana combinada:
```typescript
const isDelay24h = Boolean(
  partner.redemption_delay_24h ||
  redemptionResult?.delay_24h ||
  redemptionResult?.status === 'analise' ||
  (!partner.redemption_has_coupon && !partner.redemption_has_voucher && !partner.redemption_has_link)
);
```

### 5.2 Tipos de Parceiros e Critérios de Auto-Aprovação vs Análise Manual
1. **Cupom Imediato (`cupom`)**:
   - `redemption_has_coupon = true`, `redemption_delay_24h = false`.
   - **Comportamento:** Auto-aprovação instantânea. Retorna o código do cupom (`redemption_coupon_code` ou código dinâmico gerado).
   - O cliente recebe o cupom imediatamente na tela e no WhatsApp. O admin não precisa intervir.
2. **Link Direto (`link`)**:
   - `redemption_has_link = true`, `redemption_delay_24h = false`.
   - **Comportamento:** Auto-aprovação instantânea. Retorna a URL configurada (`redemption_link` ou `website`).
   - O cliente recebe o link clicável imediatamente.
3. **Combinado (`combinado`)**:
   - `redemption_has_link = true` E (`redemption_has_coupon = true` OU `redemption_has_voucher = true`), com `redemption_delay_24h = false`.
   - **Comportamento:** Auto-aprovação instantânea. Exibe código + link de acesso.
4. **Manual 24 Horas (`manual_24h` / `redemption_delay_24h = true`)**:
   - Exige que o administrador faça o cadastro manual do cliente na plataforma do parceiro (ex: planos de saúde pet, convênios corporativos restritos) e gere um link de ativação individual.
   - **SLA Operacional:** 24 horas corridas.
   - **Painel Admin:** Apresenta cronômetro regressivo com contagem segundo a segundo, barra de progresso e alertas visuais (Verde -> Amarelo -> Vermelho / Expirado).
5. **Re-solicitação sob Análise (`analise`)**:
   - Resgate decorrente de duplicidade forçada com justificativa.
   - **SLA Operacional:** Até 48 horas.
   - Requer aprovação explícita pelo admin no painel antes da liberação do benefício.

---

## 6. Dados Retornados no Resgate Bem-Sucedido

### 6.1 Formato do Protocolo Oficial
O protocolo gerado segue rigorosamente o padrão regulatório e corporativo do Grupo GSA:
$$\text{PROT-RES-YYYY-XXXXXX}$$
- **Regex de Validação:** `/^PROT-RES-\d{4}-[A-Z0-9]{6}$/`
- **Exemplos válidos:** `PROT-RES-2026-AB12CD`, `PROT-RES-2026-987654`.

### 6.2 Estrutura do Objeto de Retorno (`PartnerBenefitRedemptionResult`)
```typescript
export interface PartnerBenefitRedemptionResult {
  success: boolean;               // true
  resgate_id: string;             // UUID gerado na tabela parceiros_resgates
  partner_name: string;           // Nome de exibição do parceiro
  partner_slug: string;           // Slug do parceiro
  partner_logo?: string | null;   // URL da logomarca
  benefits?: string | null;       // Descrição das condições e benefícios
  tipo_resgate: 'cupom' | 'voucher' | 'link' | 'combinado' | 'manual_24h';
  codigo_gerado?: string | null;  // Cupom de desconto ou Protocolo
  protocolo?: string | null;      // Protocolo oficial PROT-RES-YYYY-XXXXXX
  has_coupon: boolean;            // Flag indicativa se possui cupom
  has_voucher: boolean;           // Flag indicativa se possui voucher
  has_link: boolean;              // Flag indicativa se possui link
  link?: string | null;           // URL do site do parceiro / ativação
  auto_redirect: boolean;         // Flag se deve redirecionar automaticamente
  instructions?: string | null;   // Instruções textuais de como utilizar
  delay_24h?: boolean;            // Flag indicativa de SLA 24h
  status?: string;                // 'pendente', 'analise', 'concluido'
}
```

### 6.3 Dados Disponibilizados ao Usuário por Tipo de Resgate
| Tipo de Parceiro | Dados Exibidos na Interface Web | Notificação WhatsApp Enviada ao Usuário |
|---|---|---|
| **Cupom Direto** | • Código do Cupom em destaque com botão "Copiar"<br>• Link de acesso ao site do parceiro<br>• Instruções de uso do parceiro | Mensagem de parabéns contendo:<br>• Código de acesso do cupom<br>• Link da parceria<br>• Instruções completas<br>• Protocolo oficial |
| **Link Direto** | • Botão de acesso externo ao site do parceiro<br>• Instruções de uso | Mensagem com link direto da parceria e protocolo oficial |
| **Manual 24h** | • Card com Protocolo Oficial (`PROT-RES-YYYY-XXXXXX`) e botão "Copiar"<br>• Linha do tempo animada com 3 etapas (1. Registrado [Verde], 2. Emissão 24h [Amarelo], 3. WhatsApp [Pendente])<br>• Confirmação dos dados de contato (Nome, WhatsApp, E-mail)<br>• Botão de redirecionamento para consulta de protocolo | Mensagem de confirmação de registro com prazo de ativação em até 24h e código de protocolo para consulta |
| **Análise de Duplicidade (48h)** | • Card com Protocolo Oficial<br>• Indicador de prazo de análise em até 48h<br>• Confirmação de justificativa submetida | Mensagem de solicitação em análise com prazo de 48h e protocolo oficial |

---

## 7. Features Discovered

| # | Categoria | Feature | Descrição | Inputs | Outputs | Comportamento de Erro | Descoberto Via |
|---|---|---|---|---|---|---|---|
| 1 | Frontend / Modal | Validação de Entrada no Resgate | Valida nome (>= 3 chars), e-mail (regex) e telefone (DDD + 10/11 dígitos). | `nomeCompleto`, `email`, `telefone` | Permite envio do formulário ou exibe toast de erro | Bloqueia submissão e exibe `toast.error` explicativo | `PartnerBenefitRedeemModal.tsx:75-93` |
| 2 | Service Layer | Detecção Prévia de Duplicidade | Consulta `parceiros_resgates` para verificar se e-mail ou telefone já resgataram o parceiro. | `parceiroId`, `email`, `telefone` | `true` se duplicado, `false` se não | Se duplicado e sem override, lança `Error(409)` | `service.ts:617-641` |
| 3 | Frontend / Modal | Popup de Justificativa de Duplicidade | Intercepta erro 409 e exibe tela modal para captura de justificativa do cliente. | Captura `justificativa` textual | Dispara re-submissão com `forceOverride=true` | Botão desabilitado se texto em branco | `PartnerBenefitRedeemModal.tsx:177-237` |
| 4 | Service Layer | Override com Justificativa e Status Análise | Atualiza o resgate para status `'analise'` com `alerta_duplicidade=true` e texto da justificativa. | `justificativaDuplicidade`, `forceOverride=true` | Resgate salvo com status `'analise'` | Erros de banco tratados silenciosamente sem travar fluxo | `service.ts:251-258` |
| 5 | Database RPC | RPC Pública de Resgate de Benefício | Registra solicitação no banco, gera protocolo oficial `PROT-RES-YYYY-XXXXXX` e define tipo de resgate. | `p_parceiro_id`, `p_parceiro_slug`, `p_nome_completo`, `p_telefone`, `p_cliente_id`, `p_email` | JSONB `{ success: true, resgate_id, protocolo, ... }` | Lança exceção SQL (`22023` para dados inválidos, `P0002` se parceiro inativo) | `20260826220000_production_remediation_consolidated.sql:272-386` |
| 6 | Service Layer | Fallback de Sobrecarga de RPC | Fallback automático para 5 parâmetros se RPC remota não tiver `p_email` (`PGRST202`). | Erro PGRST202 | Reenvio da chamada RPC sem `p_email` | Se falhar novamente, propaga erro | `service.ts:236-246` |
| 7 | Notificações | Disparo WhatsApp Cliente (SLA 24h) | Notifica o cliente via WhatsApp com texto explicativo do prazo de 24h e protocolo. | `telefone`, mensagem formatada | Booleano / Promise | Falhas de envio capturadas em `.catch()` com log | `service.ts:291-314` |
| 8 | Notificações | Disparo WhatsApp Alerta Admin | Notifica o WhatsApp da administração informando nova solicitação pendente no SLA 24h. | Título, categoria FORNECEDORES, mensagem com protocolo | Booleano / Promise | Falha tratada silenciosamente | `service.ts:316-320` |
| 9 | Notificações | Disparo WhatsApp Imediato (Cupom/Link) | Notifica o cliente via WhatsApp com cupom, link e instruções imediatas. | `telefone`, mensagem com código | Booleano / Promise | Falha tratada em `.catch()` | `service.ts:325-347` |
| 10 | Frontend / Modal | Tela de Sucesso SLA 24h / 48h | Exibe protocolo copiável, linha do tempo animada com 3 etapas e dados de contato confirmados. | `redemptionResult`, `registeredData` | Renderização visual e redirecionamento para consulta de protocolo | N/A | `PartnerBenefitRedeemModal.tsx:431-650` |
| 11 | Frontend / Modal | Tela de Sucesso Liberação Imediata | Exibe código do cupom com botão de cópia, link externo para o parceiro e instruções de uso. | `redemptionResult`, `partner` | Renderização de cupom e link | N/A | `PartnerBenefitRedeemModal.tsx:651-773` |
| 12 | Admin Service | Conclusão de Resgate com Link (`completePartnerRedemption`) | Admin cadastra link de ativação, atualiza status para `'concluido'`, grava `data_ativacao` e envia WhatsApp com imagem. | `resgateId`, `linkAtivacao`, `cupom`, `voucher`, `partnerCover`, `customerPhone` | `true` se enviado com sucesso | Lança erro se link estiver vazio ou se duplicidade não autorizada | `service.ts:376-498` |
| 13 | Admin Service | Aprovação de Resgate em Análise (`approveRedemption`) | Atualiza resgate de `'analise'` para `'pendente'` e remove `alerta_duplicidade`. | `resgateId` | `true` | Retorna `false` se falha no Supabase | `service.ts:643-654` |
| 14 | Admin Service | Recusa de Resgate com Motivo (`rejectRedemption`) | Atualiza status para `'recusado'`, registra `motivo_recusa` e envia WhatsApp notificando o cliente. | `resgateId`, `motivo` | `true` | Retorna `false` se falha no Supabase | `service.ts:656-679` |
| 15 | Public Service / RPC | Consulta Pública de Protocolo (`consultarProtocolo`) | Consulta situação de um protocolo de resgate por código sem exigir autenticação. | `codigo` (`PROT-RES-...`) | JSON com status, parceiro, titular, link_ativacao, etc. | Retorna `{ success: false, message }` se inválido ou não encontrado | `service.ts:578-615` / `20260827180000_public_protocol_consultation.sql` |
| 16 | Admin Modal | Monitor de SLA 24h em Tempo Real | Cronômetro regressivo segundo a segundo calculando tempo restante, horas/minutos/segundos e percentual decorrido. | `resgate.created_at`, relógio de 1s | Exibição dinâmica de status (Ativo, Pendente, Atrasado) | Fallback seguro se `created_at` ausente | `PartnerRedemptionDetailModal.tsx:78-122` |
| 17 | Database / Migrations | Cancelamento de Protocolo | Campo `data_cancelamento` e status `'cancelado'` para protocolos encerrados pelo usuário. | `p_codigo`, `data_cancelamento=now()` | Registro de auditoria de cancelamento | Não permite novas alterações após cancelado | `20260827200000_add_data_cancelamento_to_parceiros_resgates.sql` |

---

## 8. Edge Cases

| # | Feature | Input | Comportamento Observado |
|---|---|---|---|
| 1 | Validação de Nome | Nome com apenas 1 palavra (ex: "Adriano") | Frontend modal aceita se `length >= 3`; RPC aceita se `length >= 2`; NLU/Webhook exige nome e sobrenome (`parts.length >= 2`), pedindo para redigitar se incompleto. |
| 2 | Validação de Telefone | Telefone internacional ou com caracteres misturados (ex: `+55 (11) 98765-4321`) | Frontend sanitiza removendo `\D` e verifica `cleanPhone.length >= 10`; RPC remove caracteres não numéricos; Webhook normaliza para formato com DDI `55`. |
| 3 | E-mail Opcional / Ausente | Chamada de resgate sem preenchimento de `email` | `service.ts` envia `p_email: null`; RPC grava `NULL` em `parceiros_resgates.email`; não lança erro de constraint. |
| 4 | Sobrecarga de RPC Incompatível | Backend remoto legado sem parâmetro `p_email` (erro `PGRST202`) | `service.ts` intercepta o erro `PGRST202` / `parameters`, deleta a propriedade `p_email` do dicionário e repete a chamada com sucesso. |
| 5 | Duplicidade com Resgate Recusado | Cliente solicita parceiro no qual já teve solicitação anterior marcada como `'recusado'` | `checkDuplicateRedemption` filtra explicitamente `.neq('status', 'recusado')`, permitindo novo resgate sem acusar duplicidade e sem exigir justificativa. |
| 6 | Duplicidade com Override e Justificativa | Cliente solicita benefício já resgatado, recebe 409, digita justificativa e submete com `forceOverride=true` | Registro é inserido no banco com `alerta_duplicidade=true`, `justificativa_duplicidade` preenchido e status `'analise'`, recebendo SLA de 48h. |
| 7 | Concorrência de Resgates | Rajada concorrente de 20 requisições simultâneas para parceiro e telefone | Todos os 20 resgates recebem protocolos únicos válidos correspondentes ao regex `^PROT-RES-2026-[A-Z0-9]{6}$`. |
| 8 | Falha no Link de Ativação Admin | Administrador tenta concluir resgate com link de ativação em branco ou apenas espaços | `completePartnerRedemption` rejeita imediatamente com exceção `"Informe o link de ativação gerado no site do parceiro."`. |
| 9 | Parceiro Inativo ou Inexistente | Resgate com `parceiroSlug` inexistente ou parceiro com `status != 'ativo'` | RPC lança exceção com código de erro PostgreSQL `P0002` ("Parceiro não encontrado ou inativo."). |
| 10 | Protocolo Cancelado no Autoatendimento | Cliente envia código de protocolo que já possui `status = 'cancelado'` | Webhook identifica o status, exibe a data/hora do cancelamento e impede qualquer alteração cadastral no registro. |

---

## 9. Conclusão e Diretrizes para o Flow Conversacional do WhatsApp

Para alcançar **100% de paridade 1:1** com o sistema web no autoatendimento via WhatsApp:
1. **Coleta de Dados:** O bot deve coletar ordenadamente ou extrair via NLU o **Nome Completo**, **E-mail** e **Telefone** do cliente.
2. **Consulta e Identificação do Parceiro:** Fazer busca fuzzy na tabela `parceiros` com `status = 'ativo'` para obter o `id` e `slug`.
3. **Checagem de Duplicidade:** Executar a checagem na tabela `parceiros_resgates` para `parceiro_id` e (`email` ou `telefone`) com `status != 'recusado'`.
   - Se duplicado: Perguntar ao usuário *"Identificamos um resgate anterior. Se houver algum motivo especial para solicitar novamente, por favor envie uma justificativa."*
   - Ao receber o texto: chamar a RPC e salvar com `status = 'analise'`, `alerta_duplicidade = true` e `justificativa_duplicidade = texto`.
4. **Chamada da RPC Oficial:** Executar a RPC `gsa_public_resgatar_beneficio_parceiro` com os parâmetros canônicos.
5. **Entrega de Benefício:**
   - Se `delay_24h = true` ou `status = 'analise'`: Enviar texto de solicitação registrada com protocolo oficial e prazo (24h/48h) + alerta admin.
   - Se `delay_24h = false` (cupom/link direto): Entregar imediatamente o cupom/link e instruções na conversa.
