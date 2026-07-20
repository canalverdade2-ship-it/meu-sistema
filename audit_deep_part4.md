# Relatório do Deep Audit Protocol - FASE 4 (Race Conditions, Antipatterns React e Tipagem Insegura)

> [!WARNING]
> Varredura focada nas vulnerabilidades mais sutis do motor React: Submissões Duplas (Race Conditions), Chaves Dinâmicas Erradas (Bugs de Renderização), e Supressão Silenciosa de Tipagem.

### `src/components/admin/AcessosModule.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 544, 624, 627, 657, 679...
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 216

### `src/components/admin/AreaVIPModule.tsx`
- **Débito de Z-Index (Z-index elevados e hardcoded causam conflitos de modais):** Lines 1194
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 239

### `src/components/admin/AssinaturasModule.tsx`
- **Anti-pattern React (`key={index}` corrompe renderização de listas mutáveis):** Lines 545, 849
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 185

### `src/components/admin/CadastroModule.tsx`
- **Débito de Z-Index (Z-index elevados e hardcoded causam conflitos de modais):** Lines 227

### `src/components/admin/clientes/AdminClienteDocumentos.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 480
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 111

### `src/components/admin/ClientesModule.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 773, 774, 833, 834, 911
- **Débito de Z-Index (Z-index elevados e hardcoded causam conflitos de modais):** Lines 1701
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 780, 916

### `src/components/admin/CobrancaModule.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 865, 975, 978, 1035, 1054...
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 352

### `src/components/admin/CreditoModule.tsx`
- **Débito de Z-Index (Z-index elevados e hardcoded causam conflitos de modais):** Lines 1476, 1974, 2055, 2205
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 217, 1379

### `src/components/admin/CuponsLojaModule.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 338, 341, 349, 354, 358...

### `src/components/admin/Dashboard.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 797
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 343

### `src/components/admin/demandas/DemandasComentarios.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 216
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 127

### `src/components/admin/demandas/DemandasDashboard.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 89, 93

### `src/components/admin/demandas/DemandasDetalhesModal.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 829, 883, 894, 907, 1121...
- **Débito de Z-Index (Z-index elevados e hardcoded causam conflitos de modais):** Lines 767
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 1575

### `src/components/admin/demandas/DemandasTabela.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 176

### `src/components/admin/demandas/NovaDemandaModal.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 188, 436
- **Débito de Z-Index (Z-index elevados e hardcoded causam conflitos de modais):** Lines 179
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 467

### `src/components/admin/DemandasColaboradorModule.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 222, 264

### `src/components/admin/EmpresaModule.tsx`
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 190

### `src/components/admin/EmprestimosModule.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 663, 664, 811, 827, 843...

### `src/components/admin/FinanceiroModule.tsx`
- **Anti-pattern React (`key={index}` corrompe renderização de listas mutáveis):** Lines 2701, 2829
- **Supressão de Segurança (Uso de `@ts-ignore` ou `eslint-disable`):** Lines 2397
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 1517, 1561, 1622, 1626, 1679...
- **Débito de Z-Index (Z-index elevados e hardcoded causam conflitos de modais):** Lines 1370, 3264
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 3172

### `src/components/admin/IndicacoesModule.tsx`
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 203

### `src/components/admin/LojaTrocasModule.tsx`
- **Anti-pattern React (`key={index}` corrompe renderização de listas mutáveis):** Lines 497

### `src/components/admin/OrcamentosModule.tsx`
- **Anti-pattern React (`key={index}` corrompe renderização de listas mutáveis):** Lines 1115, 2126
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 2908, 2912, 2916
- **Débito de Z-Index (Z-index elevados e hardcoded causam conflitos de modais):** Lines 2907
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 577, 1473, 2924

### `src/components/admin/OrdensAssinaturaModule.tsx`
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 384

### `src/components/admin/OrdensCompraModule.tsx`
- **Anti-pattern React (`key={index}` corrompe renderização de listas mutáveis):** Lines 1113
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 679, 1234

### `src/components/admin/OrdensServicoModule.tsx`
- **Anti-pattern React (`key={index}` corrompe renderização de listas mutáveis):** Lines 680, 708, 953
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 350, 1031, 1035, 1039
- **Débito de Z-Index (Z-index elevados e hardcoded causam conflitos de modais):** Lines 1030
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 363, 1015

### `src/components/admin/PainelRentabilidade.tsx`
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 402

### `src/components/admin/PremiosModule.tsx`
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 838

### `src/components/admin/prestadores/AdminPrestadorDocumentos.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 262, 265, 312, 313, 317...
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 107

### `src/components/admin/prestadores/AdminPrestadorPremios.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 148
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 89

### `src/components/admin/prestadores/AdminPrestadorPromocoes.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 172, 229
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 141

### `src/components/admin/prestadores/AdminPrestadorVouchers.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 159, 192, 197
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 92

### `src/components/admin/prestadores/PrestadoresCadastro.tsx`
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 1482, 1662

### `src/components/admin/prestadores/PrestadoresDemandas.tsx`
- **Anti-pattern React (`key={index}` corrompe renderização de listas mutáveis):** Lines 1782
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 1524, 2854, 2887
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 645, 2917

### `src/components/admin/PrestadoresModule.tsx`
- **Débito de Z-Index (Z-index elevados e hardcoded causam conflitos de modais):** Lines 104

### `src/components/admin/ProdutosModule.tsx`
- **Anti-pattern React (`key={index}` corrompe renderização de listas mutáveis):** Lines 608, 972
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 180, 1241

### `src/components/admin/PromoAnalytics.tsx`
- **Anti-pattern React (`key={index}` corrompe renderização de listas mutáveis):** Lines 135
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 156

### `src/components/admin/PromocaoQuantidadeForm.tsx`
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 446

### `src/components/admin/PromocaoQuantidadeModule.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 111, 112, 113

### `src/components/admin/PromoDetalhesModal.tsx`
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 275

### `src/components/admin/ReembolsosModule.tsx`
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 835

### `src/components/admin/relatorios/RelatorioClientes.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 76, 77

### `src/components/admin/relatorios/RelatorioCobranca.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 82, 83
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 148

### `src/components/admin/relatorios/RelatorioCredito.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 76, 77

### `src/components/admin/relatorios/RelatorioEmprestimos.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 82, 83

### `src/components/admin/relatorios/RelatorioExecutivo.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 113

### `src/components/admin/relatorios/RelatorioFinanceiro.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 97, 98

### `src/components/admin/relatorios/RelatorioFiscal.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 66, 67, 68
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 113

### `src/components/admin/relatorios/RelatorioGamificacao.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 72, 73

### `src/components/admin/relatorios/RelatorioLoja.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 70, 71

### `src/components/admin/relatorios/RelatorioMarketing.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 69, 70, 71

### `src/components/admin/relatorios/RelatorioOperacional.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 72, 73, 74

### `src/components/admin/relatorios/RelatorioOS.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 71, 72, 73

### `src/components/admin/relatorios/RelatorioPrestadores.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 77, 78

### `src/components/admin/relatorios/RelatorioRentabilidade.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 225, 226

### `src/components/admin/relatorios/RelatorioSuporte.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 67, 68

### `src/components/admin/ServicosModule.tsx`
- **Anti-pattern React (`key={index}` corrompe renderização de listas mutáveis):** Lines 456, 743
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 173

### `src/components/admin/SystemMonitorModule.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 477, 598, 601, 677

### `src/components/admin/SystemStatusIndicator.tsx`
- **Débito de Z-Index (Z-index elevados e hardcoded causam conflitos de modais):** Lines 118
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 168

### `src/components/admin/TicketsModule.tsx`
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 316

### `src/components/admin/ui/AdminWhatsAppButton.tsx`
- **Débito de Z-Index (Z-index elevados e hardcoded causam conflitos de modais):** Lines 114, 157, 221

### `src/components/admin/VendasModule.tsx`
- **Débito de Z-Index (Z-index elevados e hardcoded causam conflitos de modais):** Lines 193

### `src/components/admin/VouchersModule.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 595, 774
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 779

### `src/components/client/ClientAreaVIP.tsx`
- **Anti-pattern React (`key={index}` corrompe renderização de listas mutáveis):** Lines 604
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 355

### `src/components/client/ClientAssinaturas.tsx`
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 694

### `src/components/client/ClientDashboard.tsx`
- **Débito de Z-Index (Z-index elevados e hardcoded causam conflitos de modais):** Lines 162, 267, 305, 522

### `src/components/client/ClientEmprestimos.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 546, 746, 764, 771, 774...

### `src/components/client/ClientFinanceiro.tsx`
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 353

### `src/components/client/ClientGSAStore.tsx`
- **Anti-pattern React (`key={index}` corrompe renderização de listas mutáveis):** Lines 2681, 2715, 2731
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 999, 1067, 1069, 2137, 2167...
- **Débito de Z-Index (Z-index elevados e hardcoded causam conflitos de modais):** Lines 732, 985
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 151, 347, 2026

### `src/components/client/ClientIndiqueGanhe.tsx`
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 233

### `src/components/client/ClientMeuCredito.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 756
- **Débito de Z-Index (Z-index elevados e hardcoded causam conflitos de modais):** Lines 727, 2037
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 1949

### `src/components/client/ClientOrcamentos.tsx`
- **Anti-pattern React (`key={index}` corrompe renderização de listas mutáveis):** Lines 1297, 1466
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 2246
- **Débito de Z-Index (Z-index elevados e hardcoded causam conflitos de modais):** Lines 2049
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 495

### `src/components/client/ClientPontos.tsx`
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 779

### `src/components/client/ClientPremios.tsx`
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 254

### `src/components/client/ClientProdutos.tsx`
- **Anti-pattern React (`key={index}` corrompe renderização de listas mutáveis):** Lines 483
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 605

### `src/components/client/ClientProfile.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 413, 427, 438, 449, 460...
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 707

### `src/components/client/ClientPromocoes.tsx`
- **Débito de Z-Index (Z-index elevados e hardcoded causam conflitos de modais):** Lines 334

### `src/components/client/ClientServicos.tsx`
- **Anti-pattern React (`key={index}` corrompe renderização de listas mutáveis):** Lines 468, 533
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 745, 778
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 565, 808

### `src/components/client/ClientSuporte.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 429
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 198

### `src/components/client/ClientTransferencias.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 788, 789, 828, 881, 917...
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 462

### `src/components/client/ClientVouchers.tsx`
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 372

### `src/components/client/emprestimo/EmprestimoFormSteps.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 148
- **Débito de Z-Index (Z-index elevados e hardcoded causam conflitos de modais):** Lines 41

### `src/components/client/financeiro/ExtratoList.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 187, 320
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 327

### `src/components/client/financeiro/FaturasList.tsx`
- **Anti-pattern React (`key={index}` corrompe renderização de listas mutáveis):** Lines 1136
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 575

### `src/components/client/financeiro/NotasFiscaisList.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 310
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 178

### `src/components/client/financeiro/PaymentModal.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 419, 434, 438, 459, 477
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 309

### `src/components/client/financeiro/SaquesList.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 291, 310
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 485

### `src/components/client/StoreHub.tsx`
- **Anti-pattern React (`key={index}` corrompe renderização de listas mutáveis):** Lines 2430, 2654, 2678, 2883, 3885
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 262, 1985

### `src/components/common/SupportConversationModal.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 175
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 108

### `src/components/prestador/PrestadorDemandas.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 1299

### `src/components/prestador/PrestadorDocumentos.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 343, 386, 416

### `src/components/prestador/PrestadorPremios.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 254
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 160

### `src/components/prestador/PrestadorPromocoes.tsx`
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 247

### `src/components/prestador/PrestadorSuporte.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 410
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 165

### `src/components/prestador/PrestadorVouchers.tsx`
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 154

### `src/components/ui/FileViewerModal.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 49, 52, 55, 68
- **Débito de Z-Index (Z-index elevados e hardcoded causam conflitos de modais):** Lines 37

### `src/components/ui/FullscreenPrompt.tsx`
- **Débito de Z-Index (Z-index elevados e hardcoded causam conflitos de modais):** Lines 45

### `src/components/ui/GlobalFilter.tsx`
- **Débito de Z-Index (Z-index elevados e hardcoded causam conflitos de modais):** Lines 89

### `src/components/ui/Modal.tsx`
- **Débito de Z-Index (Z-index elevados e hardcoded causam conflitos de modais):** Lines 44

### `src/components/ui/PinInput.tsx`
- **Anti-pattern React (`key={index}` corrompe renderização de listas mutáveis):** Lines 82

### `src/components/ui/UniversalNotificationBell.tsx`
- **Débito de Z-Index (Z-index elevados e hardcoded causam conflitos de modais):** Lines 80, 109

### `src/components/ui/WhatsAppButton.tsx`
- **Débito de Z-Index (Z-index elevados e hardcoded causam conflitos de modais):** Lines 95

### `src/pages/AdminPanel.tsx`
- **Débito de Z-Index (Z-index elevados e hardcoded causam conflitos de modais):** Lines 302, 315, 612
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 628

### `src/pages/ClientPortal.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 759
- **Débito de Z-Index (Z-index elevados e hardcoded causam conflitos de modais):** Lines 750, 756, 866, 1059, 1121
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 497

### `src/pages/Home.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 909, 910, 1210, 1211, 1374...
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 269

### `src/pages/Prestador/PrestadorDashboard.tsx`
- **Risco de Submissão Dupla (Botões sem bloqueio de estado `disabled` no `onClick`):** Lines 397
- **Débito de Z-Index (Z-index elevados e hardcoded causam conflitos de modais):** Lines 388, 394, 491, 620, 655...
- **Race Condition em Data Fetching (Efeito Assíncrono sem flag `isMounted` nem limpeza):** Lines 1067

