# Relatório do Deep Audit Protocol - FASE 3 (Arquitetura Oculta e Acessibilidade)

> [!WARNING]
> Varredura focada em Débito Técnico Oculto: URLs Hardcoded, Falhas Críticas de Acessibilidade (A11Y), Subscrições zumbis e Débitos não resolvidos (TODOs).

### `src/components/admin/demandas/DemandasDetalhesModal.tsx`
- **Acessibilidade Crítica (`onClick` em div sem `role="button"`):** Lines 768

### `src/components/admin/demandas/NovaDemandaModal.tsx`
- **Acessibilidade Crítica (`onClick` em div sem `role="button"`):** Lines 180

### `src/components/admin/EmprestimosModule.tsx`
- **Acessibilidade Crítica (`onClick` em div sem `role="button"`):** Lines 473

### `src/components/client/ClientEmprestimos.tsx`
- **Acessibilidade Crítica (`onClick` em div sem `role="button"`):** Lines 573, 611, 650, 799

### `src/components/client/ClientGSAStore.tsx`
- **Acessibilidade Crítica (`onClick` em div sem `role="button"`):** Lines 895, 921

### `src/components/client/StoreHub.tsx`
- **Quebra de Acessibilidade (Img sem `alt`):** Lines 2431

### `src/components/ui/FileViewerModal.tsx`
- **Quebra de Acessibilidade (Img sem `alt`):** Lines 77

