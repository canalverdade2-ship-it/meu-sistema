# Relatório Adicional do Deep Audit Protocol (Segurança, Performance Avançada e Overfetching)

> [!WARNING]
> Varredura profunda focada em vulnerabilidades de Cross-Site Scripting (XSS), Overfetching de Banco de Dados, Vazamento de Chaves, e Renderização Ineficiente de Mídia.

### `src/components/admin/AcessosModule.tsx`
- **Vulnerabilidade XSS (dangerouslySetInnerHTML):** Lines 478
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 130

### `src/components/admin/AreaVIPModule.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 277

### `src/components/admin/AssinaturasModule.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 51, 124
- **Carga de Imagem Não-Otimizada (Sem `loading="lazy"`):** Lines 278, 345, 546, 850

### `src/components/admin/CadastroModule.tsx`
- **Vulnerabilidade XSS (dangerouslySetInnerHTML):** Lines 173

### `src/components/admin/clientes/AdminClienteDocumentos.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 58

### `src/components/admin/ClientesModule.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 119, 148, 1064, 1077, 1086...

### `src/components/admin/CobrancaModule.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 89

### `src/components/admin/ConfiguracoesModule.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 25, 26, 27
- **Logs em Produção (`console.log` poluidor):** Lines 792, 799

### `src/components/admin/CreditoModule.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 178, 245, 368

### `src/components/admin/Dashboard.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 314

### `src/components/admin/demandas/DemandasComentarios.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 45

### `src/components/admin/demandas/DemandasDetalhesModal.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 1382
- **Carga de Imagem Não-Otimizada (Sem `loading="lazy"`):** Lines 1514

### `src/components/admin/DemandasColaboradorModule.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 150

### `src/components/admin/EmpresaModule.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 42

### `src/components/admin/EmprestimosModule.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 84, 85, 86, 87, 140...
- **Carga de Imagem Não-Otimizada (Sem `loading="lazy"`):** Lines 838

### `src/components/admin/FinanceiroModule.tsx`
- **Vulnerabilidade XSS (dangerouslySetInnerHTML):** Lines 1305
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 2409

### `src/components/admin/FiscalModule.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 100

### `src/components/admin/LojaCategoriasModule.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 45
- **Carga de Imagem Não-Otimizada (Sem `loading="lazy"`):** Lines 226

### `src/components/admin/LojaTrocasModule.tsx`
- **Carga de Imagem Não-Otimizada (Sem `loading="lazy"`):** Lines 498

### `src/components/admin/OrcamentosModule.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 1384, 1869, 1986, 1987, 1988

### `src/components/admin/OrdensCompraModule.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 787
- **Carga de Imagem Não-Otimizada (Sem `loading="lazy"`):** Lines 937

### `src/components/admin/OrdensServicoModule.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 378

### `src/components/admin/PainelRentabilidade.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 133

### `src/components/admin/prestadores/AdminPrestadorDocumentos.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 57

### `src/components/admin/prestadores/AdminPrestadorPremios.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 40

### `src/components/admin/prestadores/AdminPrestadorPromocoes.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 51

### `src/components/admin/prestadores/AdminPrestadorVouchers.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 41

### `src/components/admin/prestadores/PrestadoresCadastro.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 121, 1413, 1499
- **Logs em Produção (`console.log` poluidor):** Lines 220, 237, 277

### `src/components/admin/prestadores/PrestadoresDemandas.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 323, 2724
- **Carga de Imagem Não-Otimizada (Sem `loading="lazy"`):** Lines 2856

### `src/components/admin/ProdutosModule.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 56, 130, 1078
- **Carga de Imagem Não-Otimizada (Sem `loading="lazy"`):** Lines 272, 343, 609, 973

### `src/components/admin/PromocoesModule.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 83

### `src/components/admin/ReembolsosModule.tsx`
- **Carga de Imagem Não-Otimizada (Sem `loading="lazy"`):** Lines 609

### `src/components/admin/RelatoriosModule.tsx`
- **Vulnerabilidade XSS (dangerouslySetInnerHTML):** Lines 119

### `src/components/admin/ServicosModule.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 50, 123
- **Carga de Imagem Não-Otimizada (Sem `loading="lazy"`):** Lines 265, 328, 457, 744

### `src/components/admin/SystemMonitorModule.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 98

### `src/components/admin/TicketsModule.tsx`
- **Vulnerabilidade XSS (dangerouslySetInnerHTML):** Lines 386
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 248

### `src/components/admin/VendasModule.tsx`
- **Vulnerabilidade XSS (dangerouslySetInnerHTML):** Lines 139

### `src/components/client/ClientAreaVIP.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 132
- **Logs em Produção (`console.log` poluidor):** Lines 93, 118

### `src/components/client/ClientEmprestimos.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 111, 112, 270, 271, 272...

### `src/components/client/ClientFinanceiro.tsx`
- **Logs em Produção (`console.log` poluidor):** Lines 280, 418

### `src/components/client/ClientGSAStore.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 82, 210, 241, 242, 243...
- **Carga de Imagem Não-Otimizada (Sem `loading="lazy"`):** Lines 843, 898, 1029, 1089, 2682...
- **Logs em Produção (`console.log` poluidor):** Lines 326, 328, 370, 372

### `src/components/client/ClientIndiqueGanhe.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 118

### `src/components/client/ClientMeuCredito.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 195, 207, 334, 348, 359...
- **Carga de Imagem Não-Otimizada (Sem `loading="lazy"`):** Lines 1722

### `src/components/client/ClientPontos.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 158, 183, 189

### `src/components/client/ClientPremios.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 150

### `src/components/client/ClientProdutos.tsx`
- **Carga de Imagem Não-Otimizada (Sem `loading="lazy"`):** Lines 258, 370

### `src/components/client/ClientProfile.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 139

### `src/components/client/ClientPromocoes.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 117

### `src/components/client/ClientServicos.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 571, 619
- **Carga de Imagem Não-Otimizada (Sem `loading="lazy"`):** Lines 747

### `src/components/client/ClientSuporte.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 127, 146

### `src/components/client/ClientVouchers.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 70

### `src/components/client/financeiro/ExtratoList.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 44

### `src/components/client/financeiro/FaturasList.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 272, 378, 394, 588
- **Carga de Imagem Não-Otimizada (Sem `loading="lazy"`):** Lines 898

### `src/components/client/financeiro/NotasFiscaisList.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 55

### `src/components/client/financeiro/PaymentModal.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 104, 136

### `src/components/client/financeiro/SaquesList.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 96

### `src/components/client/StoreHub.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 293, 475, 491, 508, 611...
- **Carga de Imagem Não-Otimizada (Sem `loading="lazy"`):** Lines 2233, 2262, 2431, 2889, 2993...

### `src/components/common/SupportConversationModal.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 73

### `src/components/prestador/PrestadorDocumentos.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 78

### `src/components/prestador/PrestadorFinanceiro.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 116, 141

### `src/components/prestador/PrestadorPremios.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 54

### `src/components/prestador/PrestadorPromocoes.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 53, 81

### `src/components/prestador/PrestadorSuporte.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 90, 117

### `src/components/prestador/PrestadorVouchers.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 54

### `src/components/ui/FileViewerModal.tsx`
- **Carga de Imagem Não-Otimizada (Sem `loading="lazy"`):** Lines 77

### `src/components/ui/WhatsAppButton.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 25

### `src/hooks/useAdminNotifications.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 296
- **Logs em Produção (`console.log` poluidor):** Lines 422, 539

### `src/hooks/useClientNotifications.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 193
- **Logs em Produção (`console.log` poluidor):** Lines 265, 283, 303, 323, 350...

### `src/hooks/useProviderNotifications.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 105, 205
- **Logs em Produção (`console.log` poluidor):** Lines 277, 286, 305, 358, 364

### `src/hooks/useVipLevels.ts`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 13

### `src/lib/notifications.tsx`
- **Logs em Produção (`console.log` poluidor):** Lines 149

### `src/lib/pdf.ts`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 261, 343, 415

### `src/pages/ClientPortal.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 504
- **Logs em Produção (`console.log` poluidor):** Lines 185, 384, 400, 408, 420...

### `src/pages/Home.tsx`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 336

### `src/utils/gamification.ts`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 69, 203, 320

### `src/utils/promotions.ts`
- **Logs em Produção (`console.log` poluidor):** Lines 10, 46, 50, 78, 87

### `src/utils/referral.ts`
- **Logs em Produção (`console.log` poluidor):** Lines 44, 50

### `src/validation/base.ts`
- **Logs em Produção (`console.log` poluidor):** Lines 20

### `src/validation/find_prestador.ts`
- **Logs em Produção (`console.log` poluidor):** Lines 16, 17

### `src/validation/find_records.ts`
- **Logs em Produção (`console.log` poluidor):** Lines 14, 15, 28, 29

### `src/validation/master_block2.ts`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 64
- **Logs em Produção (`console.log` poluidor):** Lines 9, 12, 151

### `src/validation/master_block3.ts`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 88
- **Logs em Produção (`console.log` poluidor):** Lines 9, 12, 121

### `src/validation/master_block4.ts`
- **Logs em Produção (`console.log` poluidor):** Lines 8, 11, 64, 65, 66...

### `src/validation/step1_referral.ts`
- **Logs em Produção (`console.log` poluidor):** Lines 7, 89

### `src/validation/step2_sales_flow.ts`
- **Logs em Produção (`console.log` poluidor):** Lines 10, 155, 156

### `src/validation/step3_finance_gamification.ts`
- **Logs em Produção (`console.log` poluidor):** Lines 11, 111

### `src/validation/step4_integrity_audit.ts`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 22

### `src/validation/step5_reports_consolidation.ts`
- **Overfetching (`select('*')` sem projeção de colunas específica):** Lines 18, 44

