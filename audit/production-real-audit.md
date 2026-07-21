# Auditoria de operação real

Gerada em: 2026-07-21T13:57:07.229Z

Arquivos executáveis examinados: **271**

Bloqueadores explícitos: **14**

Ocorrências para revisão humana: **8**

## Bloqueadores

- `src/components/admin/demandas/DemandasDetalhesModal.tsx:618` — Funcionalidade apresentada como futura — `\`O atendimento da sua ordem de serviço ${codigoOs || ''} foi concluído pela equipe GSA. Em breve você receberá a confirmação final.\`,`
- `src/components/client/ClientFinanceiro.tsx:368` — Funcionalidade apresentada como futura — `'Seu pedido de liberação manual de saque foi registrado. Nossa equipe analisará e retornará via ticket em breve.',`
- `src/components/client/ClientOrcamentos.tsx:598` — Funcionalidade apresentada como futura — `toast.success('Solicitação enviada! Nossa equipe analisará seu pedido em breve.');`
- `src/components/client/ClientOrcamentos.tsx:1836` — Funcionalidade apresentada como futura — `{ id: 'media', label: 'Média', desc: 'Atenção em breve', color: 'bg-amber-50 text-amber-700 ring-amber-200', active: 'ring-amber-500 bg-amber-50' },`
- `src/components/client/ClientPremios.tsx:432` — Funcionalidade apresentada como futura — `<p className="text-sm text-neutral-500 mt-0.5">As instruções detalhadas de como usar/receber seu prêmio aparecerão aqui em breve.</p>`
- `src/components/client/ClientPremios.tsx:515` — Funcionalidade apresentada como futura — `Nossa equipe administrativa está processando seu resgate. <br/>As instruções de como utilizar seu prêmio serão liberadas em breve.`
- `src/components/client/ClientSuporte.tsx:281` — Funcionalidade apresentada como futura — `\`Seu chamado "${formData.assunto}" foi registrado. Nossa equipe retornará em breve.\`,`
- `src/components/client/financeiro/FaturasList.tsx:635` — Funcionalidade apresentada como futura — `toast.success('Contestação enviada com sucesso! Em breve nossa equipe entrará em contato.');`
- `src/components/client/financeiro/PaymentModal.tsx:386` — Funcionalidade apresentada como futura — `{paymentConfirmed ? 'Sua fatura foi quitada com sucesso.' : 'Seu pagamento manual está em análise. Você será notificado em breve.'}`
- `src/components/client/marketplace/classifieds/ClassifiedDetailPage.tsx:186` — Funcionalidade apresentada como futura — `alert('Em breve: Enviar proposta moderada via GSA.');`
- `src/lib/whatsappNotificationService.ts:165` — Funcionalidade apresentada como futura — `textoAcao = \`Agora é só aguardar! Em breve traremos uma atualização se o documento foi aprovado com sucesso ou se há alguma pendência.\`;`
- `src/lib/whatsappNotificationService.ts:394` — Funcionalidade apresentada como futura — `textoAcao = \`Agora é só aguardar! Em breve traremos uma atualização se o documento foi aprovado.\`;`
- `src/pages/ClientPortal.tsx:940` — Funcionalidade apresentada como futura — `\`Seu chamado "${assunto}" foi registrado e nossa equipe retornará em breve.\`,`
- `src/utils/paymentPropagation.ts:90` — Funcionalidade apresentada como futura — `\`O pagamento da fatura da sua solicitação de ${solicitacao.tipo} foi confirmado! O processo de logística foi iniciado e em breve o admin informará as instruções.\`,`

## Revisão humana

- `src/components/admin/ClassifiedsModule.tsx:81` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `reason = window.prompt('Motivo da rejeição do anúncio:')?.trim() || null;`
- `src/components/admin/CreditoModule.tsx:594` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const inputMotivo = window.prompt('Digite o motivo da rejeicao do documento:');`
- `src/components/admin/CreditoModule.tsx:642` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const inputMotivo = window.prompt('Digite o motivo da rejeicao da assinatura do contrato:');`
- `src/components/admin/EmprestimosModule.tsx:445` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const motivo = window.prompt('Motivo da reprovacao (o cliente recebera essa mensagem):');`
- `src/components/admin/demandas/DemandasDetalhesModal.tsx:166` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const motivo = prompt('Informe o motivo da recusa:');`
- `src/components/admin/demandas/DemandasDetalhesModal.tsx:358` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const motivo = prompt('Motivo para recusar a contraproposta do prestador:');`
- `src/components/admin/demandas/DemandasDetalhesModal.tsx:402` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const motivo = prompt('Por que deseja cancelar esta demanda?');`
- `src/lib/deleteRequest.ts:46` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const motivo = window.prompt('Exclusão restrita: qual o motivo para solicitar a exclusão deste registro? Sua solicitação será enviada para aprovação administrativa.');`
