# Auditoria de operação real

Gerada em: 2026-09-21T21:54:16.994Z

Arquivos executáveis examinados: **529**

Bloqueadores explícitos: **0**

Ocorrências para revisão humana: **35**

## Bloqueadores

Nenhum bloqueador explícito encontrado.

## Revisão humana

- `src/components/admin/demandas/DemandasDetalhesModal.tsx:263` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const motivo = prompt('Informe o motivo da recusa:');`
- `src/components/admin/demandas/DemandasDetalhesModal.tsx:446` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const motivo = prompt('Motivo para recusar a contraproposta do prestador:');`
- `src/components/admin/demandas/DemandasDetalhesModal.tsx:492` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const motivo = prompt('Por que deseja cancelar esta demanda?');`
- `src/components/admin/gsa-tv/GsaTvAiStudioTab.tsx:571` — Referência a demonstração em código executável — `<span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Demonstração ao Vivo:</span>`
- `src/components/admin/gsa-tv/GsaTvAiStudioTab.tsx:608` — Referência a demonstração em código executável — `<span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Demonstração ao Vivo:</span>`
- `src/components/admin/gsa-tv/GsaTvAiStudioTab.tsx:645` — Referência a demonstração em código executável — `<span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Demonstração ao Vivo:</span>`
- `src/components/admin/gsa-tv/GsaTvAiStudioTab.tsx:682` — Referência a demonstração em código executável — `<span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Demonstração ao Vivo:</span>`
- `src/components/admin/super-domains/financeiro/EmprestimosCreditoView.tsx:255` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const reason = prompt('Informe a justificativa da recusa de crédito:');`
- `src/components/admin/super-domains/pessoas/AfiliadosSection.tsx:188` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `notes = window.prompt('Informe o motivo da rejeição do saque:')?.trim() || null;`
- `src/components/admin/super-domains/pessoas/AfiliadosSection.tsx:196` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `notes = window.prompt('Informe o ID E2E, a referência ou o comprovante do pagamento PIX:')?.trim() || null;`
- `src/components/client/store/BlogHome.tsx:32` — Referência a demonstração em código executável — `id: 'demo-1',`
- `src/components/client/store/BlogPostPage.tsx:29` — Referência a demonstração em código executável — `} else if (postId.startsWith('demo-')) {`
- `src/components/public/SystemsBudgetModal.tsx:393` — Referência a demonstração em código executável — `<strong>Apresentação executiva:</strong> demonstração da arquitetura proposta sem compromisso contratual.`
- `src/components/public/SystemsShowcaseDialog.tsx:340` — Referência a mock em código executável — `{/* FRAME DO MOCKUP */}`
- `src/components/ui/AccessibleDialog.tsx:57` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) {`
- `src/components/ui/AccessibleDialog.tsx:63` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > aside:first-child {`
- `src/components/ui/AccessibleDialog.tsx:67` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > aside:nth-child(3) {`
- `src/components/ui/AccessibleDialog.tsx:72` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > section:nth-child(2) {`
- `src/components/ui/AccessibleDialog.tsx:78` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > header {`
- `src/components/ui/AccessibleDialog.tsx:82` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > aside:first-child {`
- `src/components/ui/AccessibleDialog.tsx:86` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > aside:first-child > div[class*="overflow-x-auto"] {`
- `src/components/ui/AccessibleDialog.tsx:92` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > aside:first-child > div[class*="overflow-x-auto"]::-webkit-scrollbar {`
- `src/components/ui/AccessibleDialog.tsx:96` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > aside:first-child > div[class*="overflow-x-auto"] > button {`
- `src/components/ui/AccessibleDialog.tsx:102` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > aside:nth-child(3) {`
- `src/components/ui/AccessibleDialog.tsx:106` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > aside:nth-child(3) h3 {`
- `src/components/ui/AccessibleDialog.tsx:111` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > section:nth-child(2) {`
- `src/components/ui/AccessibleDialog.tsx:117` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > section:nth-child(2) > div:nth-child(2) {`
- `src/components/ui/AccessibleDialog.tsx:122` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > section:nth-child(2) button {`
- `src/components/ui/AccessibleDialog.tsx:129` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) {`
- `src/components/ui/AccessibleDialog.tsx:135` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > aside:first-child {`
- `src/components/ui/AccessibleDialog.tsx:141` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > aside:nth-child(3) {`
- `src/components/ui/AccessibleDialog.tsx:149` — Referência a demonstração em código executável — `[role="dialog"][aria-label^="Laboratório de demonstração"] > div > div:nth-child(2) > section:nth-child(2) {`
- `src/components/ui/AccessibleDialog.tsx:170` — Referência a demonstração em código executável — `const isSystemsDemo = ariaLabel?.startsWith('Laboratório de demonstração') ?? false;`
- `src/lib/deleteRequest.ts:42` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const motivo = window.prompt('Exclusão restrita: qual o motivo para solicitar a exclusão deste registro? Sua solicitação será enviada para aprovação administrativa.');`
- `src/lib/wishlistStorage.ts:86` — Referência a mock em código executável — `// Se o effectiveId não for um UUID válido (ex: mock ou id não-uuid), mantém dados locais`
