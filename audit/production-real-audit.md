# Auditoria de operação real

Gerada em: 2026-08-14T17:11:04.349Z

Arquivos executáveis examinados: **423**

Bloqueadores explícitos: **0**

Ocorrências para revisão humana: **26**

## Bloqueadores

Nenhum bloqueador explícito encontrado.

## Revisão humana

- `src/components/admin/demandas/DemandasDetalhesModal.tsx:202` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const motivo = prompt('Informe o motivo da recusa:');`
- `src/components/admin/demandas/DemandasDetalhesModal.tsx:403` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const motivo = prompt('Motivo para recusar a contraproposta do prestador:');`
- `src/components/admin/demandas/DemandasDetalhesModal.tsx:448` — Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real — `const motivo = prompt('Por que deseja cancelar esta demanda?');`
- `src/components/client/store/BlogHome.tsx:32` — Referência a demonstração em código executável — `id: 'demo-1',`
- `src/components/client/store/BlogPostPage.tsx:28` — Referência a demonstração em código executável — `} else if (postId.startsWith('demo-')) {`
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
- `src/lib/r2Storage.ts:107` — Referência a demonstração em código executável — `// Filtra itens de demonstração para evitar disparo desnecessário ao Worker`
