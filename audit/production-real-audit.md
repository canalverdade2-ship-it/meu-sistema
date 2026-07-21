# Auditoria de operação real

Gerada em: 2026-07-21T15:07:23.935Z

Arquivos executáveis examinados: **278**

Bloqueadores explícitos: **0**

Ocorrências para revisão humana: **8**

## Bloqueadores

Nenhum bloqueador explícito encontrado.

## Revisão humana

- `src/components/admin/ClassifiedsModule.tsx:81` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `reason = window.prompt('Motivo da rejeição do anúncio:')?.trim() || null;`
- `src/components/admin/CreditoModule.tsx:594` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const inputMotivo = window.prompt('Digite o motivo da rejeicao do documento:');`
- `src/components/admin/CreditoModule.tsx:642` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const inputMotivo = window.prompt('Digite o motivo da rejeicao da assinatura do contrato:');`
- `src/components/admin/EmprestimosModule.tsx:445` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const motivo = window.prompt('Motivo da reprovacao (o cliente recebera essa mensagem):');`
- `src/components/admin/demandas/DemandasDetalhesModal.tsx:166` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const motivo = prompt('Informe o motivo da recusa:');`
- `src/components/admin/demandas/DemandasDetalhesModal.tsx:358` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const motivo = prompt('Motivo para recusar a contraproposta do prestador:');`
- `src/components/admin/demandas/DemandasDetalhesModal.tsx:402` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const motivo = prompt('Por que deseja cancelar esta demanda?');`
- `src/lib/deleteRequest.ts:46` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const motivo = window.prompt('Exclusão restrita: qual o motivo para solicitar a exclusão deste registro? Sua solicitação será enviada para aprovação administrativa.');`
