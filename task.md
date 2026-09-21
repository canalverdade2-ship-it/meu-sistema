# Checklist de Tarefas: Controle de Duplicidade e Recusa de Resgates

- [x] **1. Banco de Dados (Supabase)**
  - [x] Criar arquivo de migration SQL para as colunas: alerta_duplicidade, justificativa_duplicidade, motivo_recusa.
  - [x] Aplicar migration no servidor PostgreSQL (VPS).
  - [x] Garantir que a tabela aceita os status 'analise' e 'recusado'.

- [x] **2. Backend (Services & API)**
  - [x] Atualizar a lógica de criação de resgates (service.ts) para suportar verificação de duplicidade.
  - [x] Modificar a inserção para suportar o fluxo overriding com justificativa_duplicidade e alerta_duplicidade.
  - [x] Criar action/função rejectRedemption para tratar recusas.
  - [x] Criar integração com Evolution API na rota de recusa para disparar notificação instantânea para o cliente via WhatsApp.
  - [x] Criar action/função approveRedemption para limpar o alerta e mover o status para pendente.

- [x] **3. Frontend Público (Client Redeem Modal)**
  - [x] Alterar o modal de resgate para fazer a chamada prévia de verificação de duplicidade (mesmo email/telefone no mesmo parceiro).
  - [x] Construir o pop-up sobreposto de alerta "Você já resgatou...".
  - [x] Construir campo e estado para a "Justificativa".
  - [x] Atualizar o componente de consulta Web para exibir status "Recusado" com motivo.

- [x] **4. Frontend Admin (Gestão de Parceiros)**
  - [x] Modificar PartnerRedemptionDetailModal.tsx para sinalizar visualmente (badges, alertas) os pedidos em analise.
  - [x] Inserir botões **"Aprovar"** e **"Recusar"** nos pedidos normais pendentes e nos em análise.
  - [x] Criar o mini modal de entrada de texto (Motivo da Recusa) acionado ao clicar em recusar.
  - [x] Interligar botões de admin com os novos actions de aprovação/recusa.

- [x] **5. Robô de Atendimento (VPS WhatsApp Webhook)**
  - [x] Atualizar server_webhook_vps_live.cjs na ramificação de consultar.
  - [x] Formatar adequadamente o painel de status quando um protocolo estiver recusado, exibindo a razão para o cliente.
  - [x] Fazer deploy do arquivo atualizado para a VPS.
