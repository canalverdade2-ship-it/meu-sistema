# Auditoria de operação real

Gerada em: 2026-07-22T23:55:37.303Z

Arquivos executáveis examinados: **328**

Bloqueadores explícitos: **0**

Ocorrências para revisão humana: **11**

## Bloqueadores

Nenhum bloqueador explícito encontrado.

## Revisão humana

- `src/components/admin/CreditoModule.tsx:594` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const inputMotivo = window.prompt('Digite o motivo da rejeicao do documento:');`
- `src/components/admin/CreditoModule.tsx:642` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const inputMotivo = window.prompt('Digite o motivo da rejeicao da assinatura do contrato:');`
- `src/components/admin/EmprestimosModule.tsx:445` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const motivo = window.prompt('Motivo da reprovacao (o cliente recebera essa mensagem):');`
- `src/components/admin/FornecedoresModule.tsx:82` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const reasonText = action === 'aprovar' ? '' : window.prompt('Informe o motivo:')?.trim();`
- `src/components/admin/FornecedoresModule.tsx:86` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const saleValue = window.prompt('Valor de venda do novo produto:', String(request.custo_unitario || 0));`
- `src/components/admin/FornecedoresModule.tsx:124` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const reasonText = action === 'aprovar' ? window.prompt('Observação da aprovação (opcional):') || '' : window.prompt('Informe o motivo:')?.trim();`
- `src/components/admin/FornecedoresModule.tsx:141` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const method = window.prompt('Forma de pagamento:', 'PIX') || 'PIX';`
- `src/components/admin/demandas/DemandasDetalhesModal.tsx:166` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const motivo = prompt('Informe o motivo da recusa:');`
- `src/components/admin/demandas/DemandasDetalhesModal.tsx:358` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const motivo = prompt('Motivo para recusar a contraproposta do prestador:');`
- `src/components/admin/demandas/DemandasDetalhesModal.tsx:402` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const motivo = prompt('Por que deseja cancelar esta demanda?');`
- `src/lib/deleteRequest.ts:42` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const motivo = window.prompt('Exclusão restrita: qual o motivo para solicitar a exclusão deste registro? Sua solicitação será enviada para aprovação administrativa.');`
