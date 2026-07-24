# Auditoria de operação real

Gerada em: 2026-07-24T00:48:41.514Z

Arquivos executáveis examinados: **335**

Bloqueadores explícitos: **0**

Ocorrências para revisão humana: **34**

## Bloqueadores

Nenhum bloqueador explícito encontrado.

## Revisão humana

- `src/components/admin/AffiliateAdminModule.tsx:177` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const notes = action === 'reject' ? window.prompt('Informe o motivo da rejeição:')?.trim() : \`Ação ${action} realizada no painel administrativo.\`;`
- `src/components/admin/CreditoModule.tsx:594` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const inputMotivo = window.prompt('Digite o motivo da rejeicao do documento:');`
- `src/components/admin/CreditoModule.tsx:642` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const inputMotivo = window.prompt('Digite o motivo da rejeicao da assinatura do contrato:');`
- `src/components/admin/EmprestimosModule.tsx:445` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const motivo = window.prompt('Motivo da reprovacao (o cliente recebera essa mensagem):');`
- `src/components/admin/demandas/DemandasDetalhesModal.tsx:166` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const motivo = prompt('Informe o motivo da recusa:');`
- `src/components/admin/demandas/DemandasDetalhesModal.tsx:358` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const motivo = prompt('Motivo para recusar a contraproposta do prestador:');`
- `src/components/admin/demandas/DemandasDetalhesModal.tsx:402` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const motivo = prompt('Por que deseja cancelar esta demanda?');`
- `src/components/public/SystemsExamplesDialog.tsx:288` — Referência a demonstração em código executável — `ariaLabel={data ? \`Laboratório de demonstração de ${data.eyebrow}\` : 'Laboratório de produtos digitais'}`
- `src/components/public/SystemsExamplesDialog.tsx:298` — Referência a demonstração em código executável — `<p className="text-[8px] font-black uppercase tracking-[0.18em] text-cyan-300">Ambiente de demonstração</p>`
- `src/components/public/SystemsExamplesDialog.tsx:302` — Referência a demonstração em código executável — `<div className="hidden items-center rounded-lg border border-white/10 bg-black/20 p-1 sm:flex" aria-label="Escolher dispositivo da demonstração">`
- `src/components/public/SystemsExamplesDialog.tsx:307` — Referência a demonstração em código executável — `<button type="button" onClick={onClose} data-dialog-autofocus aria-label="Fechar demonstração" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/12 text-slate-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 `
- `src/components/public/SystemsExamplesDialog.tsx:335` — Referência a demonstração em código executável — `<div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-300" /><span className="text-[8px] font-black uppercase tracking-wider text-emerald-300">Demonstração ativa</span></div>`
- `src/components/public/SystemsExamplesDialog.tsx:343` — Referência a demonstração em código executável — `<button type="button" onClick={() => changeModel(selectedIndex - 1)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:border-cyan-300/35 hover:text-cyan-300" aria-label="Demonstração anterior"><ArrowLeft className="h-4 w-4`
- `src/components/public/SystemsExamplesDialog.tsx:345` — Referência a demonstração em código executável — `<button type="button" onClick={() => changeModel(selectedIndex + 1)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:border-cyan-300/35 hover:text-cyan-300" aria-label="Próxima demonstração"><ArrowRight className="h-4 w-4`
- `src/components/ui/AccessibleDialog.tsx:59` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) {`
- `src/components/ui/AccessibleDialog.tsx:65` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > aside:first-child {`
- `src/components/ui/AccessibleDialog.tsx:69` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > aside:nth-child(3) {`
- `src/components/ui/AccessibleDialog.tsx:74` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > section:nth-child(2) {`
- `src/components/ui/AccessibleDialog.tsx:80` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > header {`
- `src/components/ui/AccessibleDialog.tsx:84` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > aside:first-child {`
- `src/components/ui/AccessibleDialog.tsx:88` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > aside:first-child > div[class*="overflow-x-auto"] {`
- `src/components/ui/AccessibleDialog.tsx:94` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > aside:first-child > div[class*="overflow-x-auto"]::-webkit-scrollbar {`
- `src/components/ui/AccessibleDialog.tsx:98` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > aside:first-child > div[class*="overflow-x-auto"] > button {`
- `src/components/ui/AccessibleDialog.tsx:104` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > aside:nth-child(3) {`
- `src/components/ui/AccessibleDialog.tsx:108` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > aside:nth-child(3) h3 {`
- `src/components/ui/AccessibleDialog.tsx:113` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > section:nth-child(2) {`
- `src/components/ui/AccessibleDialog.tsx:119` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > section:nth-child(2) > div:nth-child(2) {`
- `src/components/ui/AccessibleDialog.tsx:124` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > section:nth-child(2) button {`
- `src/components/ui/AccessibleDialog.tsx:131` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) {`
- `src/components/ui/AccessibleDialog.tsx:137` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > aside:first-child {`
- `src/components/ui/AccessibleDialog.tsx:143` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > aside:nth-child(3) {`
- `src/components/ui/AccessibleDialog.tsx:151` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > section:nth-child(2) {`
- `src/components/ui/AccessibleDialog.tsx:172` — Referência a demonstração em código executável — `const isSystemsDemo = ariaLabel?.startsWith('Laboratório de demonstração') ?? false;`
- `src/lib/deleteRequest.ts:42` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const motivo = window.prompt('Exclusão restrita: qual o motivo para solicitar a exclusão deste registro? Sua solicitação será enviada para aprovação administrativa.');`
