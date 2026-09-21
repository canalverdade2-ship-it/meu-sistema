# [Plano de Implementação] Controle de Duplicidade e Recusa de Resgates

Implementar uma barreira de proteção para evitar que o mesmo cliente resgate benefícios múltiplas vezes sem aprovação, incluindo alertas de duplicidade, fluxo de justificativa, e processo de análise gerencial (aprovação/recusa).

## User Review Required

> [!IMPORTANT]
> **Definição de Status:** Os protocolos agora terão dois novos status: `analise` (quando aguardam aprovação devido à duplicidade) e `recusado` (quando o administrativo recusa o pedido).
> 
> **Validação de Duplicidade:** A validação será feita cruzando o **E-mail** OU o **Telefone** na tabela de resgates contra os resgates anteriores do **mesmo parceiro**. Se o cliente já tiver um histórico de resgate para o parceiro em questão, o alerta de duplicidade será ativado.

## Regras de Negócio Definidas

> [!TIP]
> 1. **Validação por Parceiro:** A validação de duplicidade (e-mail ou telefone) checará apenas resgates do **mesmo parceiro** (um cliente pode resgatar benefícios de parceiros diferentes sem cair na malha de duplicidade).
> 2. **SLA Estendido:** O prazo para resgates em análise (com alerta de duplicidade) começará a contar na tela do Admin com um **SLA padrão de 48h** para o card específico (substituindo o tradicional de 24h).

## Proposed Changes

---

### 1. Banco de Dados (Supabase)

Adição de colunas na tabela `parceiros_resgates` para suportar o novo fluxo de análise.

#### [MODIFY] Migration de Banco de Dados
- **Criar colunas adicionais:**
  - `alerta_duplicidade` (BOOLEAN DEFAULT false)
  - `justificativa_duplicidade` (TEXT)
  - `motivo_recusa` (TEXT)
- Atualizar a verificação de status permitidos (se houver restrição) para incluir `'analise'` e `'recusado'`.

---

### 2. Frontend Público (Área do Cliente)

A tela onde o cliente solicita o resgate fará uma pré-verificação antes de concluir a solicitação.

#### [MODIFY] `src/components/public/PartnerBenefitRedeemModal.tsx` (ou arquivo do formulário de resgate)
- Adicionar lógica de pré-validação (novo endpoint/action) ao submeter os dados.
- Se o backend retornar `duplicado = true`, exibir um pop-up sobreposto informando: *"Você já resgatou um benefício no sistema. Deseja enviar mesmo assim?"*
- Exibir campo de texto para **Justificativa** (obrigatório se quiser prosseguir).
- Submeter o resgate final enviando a justificativa.
- **Consultar Protocolo Web:** Atualizar o card de status para refletir o estado "RECUSADO" e exibir o motivo da recusa, se houver.

---

### 3. Backend (Rotas e Actions)

Lógica de verificação e criação com os novos status.

#### [MODIFY] `src/features/partners/service.ts`
- Modificar a função de inserção de novo resgate:
  - Fazer consulta prévia verificando se o `telefone` ou `email` já existe na tabela `parceiros_resgates`.
  - Se a flag `overrideDuplicity` não for enviada pelo client, barrar a requisição e retornar alerta de duplicidade.
  - Se a requisição vier com a justificativa, inserir o resgate com `status = 'analise'`, `alerta_duplicidade = true` e preencher `justificativa_duplicidade`.
- Criar funções para o Admin: `approveRedemption` e `rejectRedemption`.
  - A função de recusa precisará receber o `motivo_recusa`, atualizar o banco e disparar imediatamente a **Notificação via WhatsApp** utilizando a Evolution API.

---

### 4. Frontend Admin (Gerenciamento)

Painel onde você visualiza a lista de resgates e os processa, aprova ou recusa.

#### [MODIFY] `src/components/admin/super-domains/pessoas/PartnerRedemptionDetailModal.tsx` (ou componente similar da lista)
- **Para Resgates em Análise (Duplicados):**
  - Detectar resgates com `status === 'analise'` e `alerta_duplicidade === true`.
  - Exibir um alerta vermelho/amarelo chamativo no card: **"⚠️ Alerta de Duplicidade"** seguido da justificativa do cliente.
  - Ocultar o botão "INSERIR LINK DE ATIVAÇÃO" nesse status.
  - Exibir dois botões novos: **"✅ Aprovar"** e **"❌ Recusar"**.
  - Se clicar em **Aprovar**, o status muda para `pendente` e a interface volta ao fluxo normal, liberando a inserção do link.
- **Para Resgates Pendentes (Normais/Regulares):**
  - Adicionar o botão **"❌ Recusar"** ao lado do botão "INSERIR LINK DE ATIVAÇÃO". Caso haja algum problema com o parceiro e o benefício não possa ser ativado, o admin poderá recusar de imediato.
- **Fluxo de Recusa Global:**
  - Independentemente se for um pedido em análise ou um pedido pendente regular, ao clicar em **Recusar**, abrir um mini modal pedindo o **Motivo da Recusa** (campo de texto obrigatório) e enviar a recusa.

---

### 5. Chatbot e Notificações (VPS / Anti-ban)

Integração com o robô de autoatendimento para refletir a recusa.

#### [MODIFY] `server_webhook_vps_live.cjs` (VPS)
- Atualizar a função de consulta de status (`nlu.intent === 'consultar'`).
- Se `status === 'recusado'`, exibir a mensagem com o motivo da recusa:
  ```
  📋 *Situação do Protocolo {codigo}*
  
  • *Parceiro:* {Parceiro}
  • *Status:* ❌ RECUSADO
  
  🛑 *Motivo da Recusa:* {motivo_recusa}
  ```
- Essa alteração precisará ser disparada para a VPS após a implementação dos pontos acima.

## Verification Plan

### Manual Verification
1. Tentar solicitar um resgate usando um telefone limpo (deve ir direto para `pendente`).
2. Tentar recusar esse resgate normal no painel Admin (verificar modal de motivo, envio de recusa para o WhatsApp e mudança de status).
3. Tentar solicitar novamente com o mesmo telefone do passo 1 (deve exibir pop-up e pedir justificativa).
4. Inserir justificativa e concluir (protocolo deve ser gerado como `analise`).
5. Abrir o painel Admin e verificar a presença do alerta de duplicidade e a justificativa no card.
6. Clicar em recusar, preencher motivo, verificar recebimento da notificação no WhatsApp do cliente informando o motivo, e se o status mudou.
7. Consultar os protocolos pelo chatbot e verificar se o motivo da recusa aparece perfeitamente formatado.
