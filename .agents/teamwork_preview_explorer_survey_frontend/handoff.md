# Relatório de Auditoria e Survey do Frontend do Marketplace GSA

## 1. Observation

### 1.1 Compilação, Build e Verificação Estática
- **TypeScript Typecheck (`npx tsc --noEmit` e `npm run typecheck:strict`)**:
  Executado em ambiente local.
  Resultado: Código de saída 0, sem erros de compilação ou violações de regras de hooks em todo o projeto.
- **Build de Produção (`npm run build`)**:
  Executado via Vite v6.4.3.
  Resultado: Código de saída 0 (construído com sucesso em 1m 15s, 4543 módulos transformados).
  Aviso emitido pelo compilador Rollup/Vite:
  ```
  (!) src/components/client/store/AvailableCouponsModal.tsx is dynamically imported by src/components/client/ClientGSAStore.tsx but also statically imported by src/components/client/store/CheckoutPage.tsx, src/components/client/store/TravelCheckoutModal.tsx, dynamic import will not move module into another chunk.
  ```
  Avisos de tamanho de bundle (> 650 kB): `MarketplaceGSAStore-BlYnh_Kn.js` (880.21 kB), `GsaTvModule-CwW-tNEC.js` (840.28 kB), `CadastroModule-DjZXe4hc.js` (679.16 kB), `ClientPortal-B_OiX4uy.js` (665.99 kB).
- **Suíte de Testes Automatizados Vitest**:
  Comando: `npx vitest run src/tests/marketplace-concurrency-simulation.test.ts src/tests/marketplace-returns-exchanges-atomicity.test.ts src/tests/marketplace-checkout-concurrency-audit.test.ts src/tests/marketplace-checkout-pricing.test.ts src/tests/marketplace-pricing-integrity.test.ts`
  Resultado: 5 arquivos de testes, **129 testes executados com 100% de aprovação (0 falhas)**:
  - `marketplace-checkout-concurrency-audit.test.ts`: 15 passed
  - `marketplace-returns-exchanges-atomicity.test.ts`: 25 passed
  - `marketplace-concurrency-simulation.test.ts`: 58 passed
  - `marketplace-checkout-pricing.test.ts`: 20 passed
  - `marketplace-pricing-integrity.test.ts`: 11 passed
- **Auditoria de Operação Real (`node scripts/audit-production-real.mjs`)**:
  525 arquivos examinados.
  Bloqueadores (2): Comentários em `src/components/admin/gsa-tv/GsaTvMasterControl.tsx:215` e `src/lib/gsaTvCommercialBreaks.ts:80` contendo a palavra 'fictício' em comentários de sanitização.
  Itens para revisão no marketplace (2):
  - `src/components/client/store/BlogHome.tsx:32`: `id: 'demo-1'`
  - `src/components/client/store/BlogPostPage.tsx:29`: `postId.startsWith('demo-')`

---

### 1.2 CheckoutPage.tsx (`src/components/client/store/CheckoutPage.tsx`)
- **Chamada Atômica RPC (`gsa_client_checkout_store`)**:
  Linhas 1088-1106:
  ```tsx
  const data = await callClientRpc<any>('gsa_client_checkout_store', {
    p_payload: {
      request_id: checkoutRequestId.current,
      carrinho: cartItems.map((item: CartItem) => ({
        item_id: item.item_id,
        tipo: item.tipo,
        quantidade: item.quantidade,
        ...(item.tipo === 'produto' ? { variante_id: item.produto_variante_id || null } : {}),
        ...(item.tipo === 'assinatura' ? { prazo_meses: item.prazo_meses || 1 } : {}),
      })),
      forma_pagamento: formaPagamento === 'credito_loja' ? 'credito_loja' : 'outros',
      pontos_usados: usarPontos ? Math.min(pontosAplicados, maxPontosValidos) : 0,
      saldo_carteira_usado: descontoCarteira,
      cupom_desconto_id: cupomDesconto?.id || null,
      cupom_entrega_id: cupomEntrega?.id || null,
      endereco_entrega: enderecoCompleto,
      parcelas: formaPagamento === 'credito_loja' && opcaoPagamentoParcelado ? numParcelas : 1,
    }
  });
  ```
- **Tratamento de Exceções do RPC e Estoque Esgotado**:
  Linhas 1190-1199:
  ```tsx
  } catch (e: any) {
    console.error('[CheckoutPage] Erro no RPC:', e);
    const raw = String(e?.message || '');
    const friendly = /produto indispon/i.test(raw)
      ? 'Um dos produtos do carrinho saiu do catálogo. Remova-o antes de concluir a compra.'
      : raw || 'Falha ao processar compra. Tente novamente.';
    toast.error(friendly);
  } finally {
    setIsSubmitting(false);
    isSubmittingRef.current = false;
  }
  ```
  A mensagem lançada pelo banco em `20260716183010_update_checkout_function.sql:220` é:
  `RAISE EXCEPTION 'Estoque insuficiente para %.', v_product.nome;`
  A regex `/produto indispon/i` não captura esta mensagem; o toast exibe a mensagem bruta, mas **o carrinho não é atualizado via `fetchCartItems()` no catch**, mantendo os itens inválidos no estado local.
- **Validação Pré-Submit de Estoque sem Suporte a Variações**:
  Linhas 995-1049:
  ```tsx
  const { data: dbProducts } = await supabase
    .from('produtos')
    .select('id, valor, valor_promocional, desconto_ativo, desconto_fim_em, desconto_prazo_tipo, desconto_limite_quantidade_ativo, desconto_quantidade_limite, desconto_quantidade_utilizada, visivel_na_loja, estoque_disponivel, controle_estoque')
    .in('id', productIds);
  ...
  const hasInvalidOrDeleted = cartItems.some((c: any) => 
    !c.item_detalhes 
    || (c.tipo === 'produto' && c.item_detalhes?.controle_estoque && (c.item_detalhes?.estoque_disponivel <= 0))
  );
  ```
  `cartItems` enriquece `item_detalhes` exclusivamente a partir da tabela `produtos` (linhas 251-260). A tabela `produto_variantes` não é consultada nessa validação. Se uma variação específica (`produto_variante_id`) estiver esgotada, a validação pré-submit do cliente avalia o estoque do produto pai (que pode ser aggregate ou desprovido de controle), permitindo o envio do RPC e gerando falha apenas na transação SQL.
- **Idempotência do Checkout**:
  Linhas 139-141:
  ```tsx
  useEffect(() => {
    checkoutRequestId.current = generateUUID();
  }, [cartItems, endereco, cupomDesconto, cupomEntrega, formaPagamento, numParcelas]);
  ```
  A chave de idempotência é regenerada corretamente a cada mutação de dados do checkout, prevenindo bloqueio por duplicidade em retentativas.
- **Acoplamento Reativo PIX / Saldo / Pontos**:
  Linhas 849-863 e 906-912:
  ```tsx
  const pixDiscountBlockedByPoints = usarPontos && pontosAplicados > 0 && !lojaPixDescontoPermitirPontos;
  const pixDiscountBlockedByWallet = usarSaldoCarteira && saldoCarteiraAplicado > 0 && !lojaPixDescontoPermitirCarteira;
  const isPixDiscountEligible = isPix && lojaPixDescontoAtivo && !pixDiscountBlockedByPoints && !pixDiscountBlockedByWallet;
  ...
  const totalAntesCarteira = Number(Math.max(0, totalAntesResgates - descontoPontos - pixDiscountValue).toFixed(2));
  const maxSaldoValido = Number(Math.min(saldoCarteiraUtilizavel, totalAntesCarteira).toFixed(2));
  ...
  useEffect(() => {
    setSaldoCarteiraAplicado((prev) => (prev > maxSaldoValido ? maxSaldoValido : prev));
  }, [maxSaldoValido]);
  ```
  A ativação de `saldoCarteiraAplicado > 0` remove o `pixDiscountValue` da conta, o que incrementa `totalAntesCarteira` e consequentemente aumenta `maxSaldoValido`. Não gera loop infinito (graças à condição `prev > maxSaldoValido`), mas produz uma cascata visual onde a aplicação do saldo da carteira anula o desconto PIX concedido na etapa anterior.
- **Dead Code (Imports Não Utilizados)**:
  Linhas 3-9: Os seguintes 10 ícones de `lucide-react` são importados mas nunca utilizados no arquivo:
  `ChevronLeft`, `ChevronRight`, `Diamond`, `Lock`, `Building`, `RefreshCw`, `Plus`, `Minus`, `Sparkles`, `ExternalLink`.

---

### 1.3 ProductPage.tsx (`src/components/client/store/ProductPage.tsx`)
- **Bug Crítico de Sobrescrita de Variações no Carrinho**:
  Linhas 508-531 (Cliente Autenticado):
  ```tsx
  const { data: existing } = await supabase
    .from('loja_carrinhos')
    .select('id, quantidade')
    .eq('cliente_id', clientId)
    .eq('item_id', product.id)
    .maybeSingle();

  if (existing) {
    const novaQuantidade = Number(existing.quantidade || 1) + quantity;
    const quantidadeFinal = purchaseControlsStock ? Math.min(novaQuantidade, purchaseStock) : novaQuantidade;
    await clientOperationalWrite(clientId, 'loja_carrinhos', 'update', {
      quantidade: quantidadeFinal,
      ...(variationSelection?.variante_id ? { produto_variante_id: variationSelection.variante_id } : {}),
      updated_at: new Date().toISOString()
    }, { id: existing.id });
  } else {
    ...
  }
  ```
  Na linha 512, a busca pelo item existente no carrinho filtra apenas por `.eq('item_id', product.id)`. Se o cliente já possui a Variação A (ex: Tamanho M) no carrinho e adiciona a Variação B (ex: Tamanho G) do mesmo produto, a consulta localiza o registro da Variação A, sobrescreve `produto_variante_id` com a Variação B e soma as quantidades, destruindo a Variação A que já estava no carrinho!
  O mesmo problema ocorre no modo visitante (linhas 472-484):
  ```tsx
  const existingIdx = parsed.items.findIndex(
    (c: any) => c.item_id === product.id && c.tipo === 'produto'
  );
  ```
  Em contraste, a implementação canônica em `ClientGSAStore.tsx:974-984` realiza o filtro correto por variação:
  ```tsx
  let query = supabase.from('loja_carrinhos')
    .select('id, quantidade')
    .eq('cliente_id', clientId)
    .eq('item_id', item.id);

  if (variation?.variante_id) {
    query = query.eq('produto_variante_id', variation.variante_id);
  } else {
    query = query.is('produto_variante_id', null);
  }
  ```
- **Dead Code**:
  Linha 15: O ícone `Eye` de `lucide-react` é importado mas nunca utilizado.

---

### 1.4 CartDrawer.tsx (`src/components/client/store/CartDrawer.tsx`)
- **Detecção Incompleta de Estoque em Variações**:
  Linhas 151-160:
  ```tsx
  const hasOutOfStockItems = cartItems.some((item) => (
    !item.item_detalhes
    || isUnavailableItem(item)
    || (item.tipo === 'produto'
    && item.item_detalhes?.controle_estoque
    && Number(item.item_detalhes?.estoque_disponivel || 0) <= 0)
    || (item.tipo === 'produto'
    && item.item_detalhes?.controle_estoque
    && Number(item.quantidade || 0) > Number(item.item_detalhes?.estoque_disponivel || 0))
  ));
  ```
  `item.item_detalhes` refere-se ao produto pai. Se o produto possui variações (`item.produto_variante_id`), o estoque da variação específica não é inspecionado. O botão de Checkout permanece ativo mesmo se a variante estiver esgotada no estoque.

---

### 1.5 LojaTrocasModule.tsx (`src/components/admin/LojaTrocasModule.tsx`)
- **Integração com RPC Atômica**:
  Linhas 93-99 e 168-177: Utiliza a RPC atômica `gsa_admin_atualizar_solicitacao_loja` com credenciais administrativas validadas via `getAdminSessionForRpc()`.
- **Bug de Reatividade no Realtime Channel**:
  Linhas 38-51:
  ```tsx
  useEffect(() => {
    fetchSolicitacoes();

    const channel = supabase
      .channel('admin-loja-solicitacoes-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loja_solicitacoes' }, () => {
        fetchSolicitacoes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab, search]);
  ```
  A inclusão de `search` na dependência do `useEffect` faz com que o canal Realtime seja destruído e recriado a cada caractere digitado pelo administrador no campo de busca.
- **Bug de Paginação Desconectada**:
  Linhas 28, 73, 362 e 372:
  ```tsx
  const [page, setPage] = useState(0);
  ...
  .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
  ...
  onClick={() => setPage((p) => p - 1)}
  onClick={() => setPage((p) => p + 1)}
  ```
  `page` **não está presente** no array de dependências do `useEffect` (linha 51), e as funções `onClick` apenas alteram o estado sem disparar `fetchSolicitacoes()`. Quando o administrador clica para avançar ou recuar de página, a tabela não recarrega os dados.

---

## 2. Logic Chain

1. **Premissa de Estabilidade de Compilação**:
   - Da Observação 1.1, `npx tsc --noEmit` e `npm run typecheck:strict` finalizaram sem nenhum erro de tipagem.
   - O comando `npm run build` gerou a distribuição de produção com código de saída 0.
   - Todos os 129 testes automatizados do ecossistema de marketplace passaram com 100% de sucesso.
   - *Inferência*: A integridade sintática e de tipagem das correções ACID recém-introduzidas está estável.

2. **Cadeia de Comportamento na Rejeição de Estoque**:
   - Da Observação 1.2, o backend PostgreSQL gera `RAISE EXCEPTION 'Estoque insuficiente para %.'`.
   - Em `CheckoutPage.tsx:1190-1199`, a cláusula `catch` exibe o erro bruto no toast, mas não executa `fetchCartItems()`.
   - Da Observação 1.4, `CartDrawer.tsx` e `CheckoutPage.tsx` avaliam apenas `produtos.estoque_disponivel`, omitindo `produto_variantes.estoque_disponivel`.
   - *Inferência*: O frontend possui uma lacuna na pré-validação de estoque para produtos com variantes. O erro é delegado integralmente ao PostgreSQL, e após a rejeição da transação, o usuário fica retido no passo de confirmação com dados de carrinho defasados, forçando atualização manual da página.

3. **Cadeia de Integridade do Carrinho com Múltiplas Variações**:
   - Da Observação 1.3, `ProductPage.tsx:508-531` localiza itens do carrinho usando unicamente `eq('item_id', product.id)` e modo guest usa `findIndex(c => c.item_id === product.id)`.
   - Ao adicionar duas variantes do mesmo produto (ex: Camiseta P e Camiseta G), a segunda variante sobrescreve a primeira tanto no Supabase quanto no LocalStorage.
   - Em contrapartida, `ClientGSAStore.tsx:974-984` implementa a distinção correta por `produto_variante_id`.
   - *Inferência*: Existe uma inconsistência arquitetural entre `ProductPage.tsx` e `ClientGSAStore.tsx`, onde adicionar itens a partir da página de detalhes do produto corrompe seleções anteriores de variantes do mesmo item.

4. **Cadeia de Performance e Reatividade**:
   - Da Observação 1.5, `LojaTrocasModule.tsx` recria canais Realtime a cada tecla pressionada no filtro de busca.
   - Além disso, a navegação de páginas (`page`) falha em acionar nova busca de solicitações.
   - *Inferência*: O painel administrativo de trocas sofre com vazamento transitório de conexões WebSocket durante pesquisas e possui navegação de paginação inoperante.

---

## 3. Caveats

- Não foram efetuadas modificações diretas no código-fonte, respeitando a diretriz de papel somente leitura (`explorer`).
- O comportamento visual do pagamento em cartão de crédito da InfinitePay em ambiente real depende de chave de API externa (`createInfinitePayOrderCheckout`); a validação concentrou-se no ciclo de controle de estado do React.
- Os 2 bloqueadores encontrados por `audit-production-real.mjs` estão localizados em `src/components/admin/gsa-tv/` e decorrem do uso da palavra 'fictício' em comentários explicativos, não afetando o módulo do marketplace.

---

## 4. Conclusion

O ecossistema frontend do marketplace GSA encontra-se funcionalmente alinhado às transações ACID do backend, com compilação limpa (TypeScript e Vite build) e aprovação em 100% dos 129 testes automatizados. 

Contudo, a auditoria identificou **4 pontos críticos de atenção no frontend** que requerem remediação:
1. **Perda de variantes no carrinho (`ProductPage.tsx:508-531` e `472-484`)**: A consulta a `loja_carrinhos` não filtra por `produto_variante_id`, sobrescrevendo variantes existentes do mesmo produto.
2. **Falha na pré-validação de estoque de variantes (`CheckoutPage.tsx:1030-1049` e `CartDrawer.tsx:151-160`)**: O estoque é consultado apenas no produto pai, permitindo que variantes sem estoque tentem finalizar a compra.
3. **Ausência de auto-recuperação do carrinho em erros de estoque (`CheckoutPage.tsx:1190-1199`)**: Rejeições do PostgreSQL exibem toast mas não chamam `fetchCartItems()`, deixando a UI em estado dessincronizado.
4. **Instabilidade de Realtime e Paginação Quebrada em `LojaTrocasModule.tsx`**: O canal Realtime é recriado a cada digitação no campo de busca (`[activeTab, search]`), e a mudança de página (`page`) não recarrega os dados.
5. **Código Ocioso e Avisos**: 10 ícones não utilizados em `CheckoutPage.tsx`, 1 em `ProductPage.tsx`, e aviso do Rollup/Vite sobre importação estática/dinâmica conflitante de `AvailableCouponsModal.tsx`.

---

## 5. Verification Method

Para reproduzir e validar independentemente todos os achados deste relatório:

1. **Validação de Compilação e Build**:
   ```powershell
   npx tsc --noEmit
   npm run typecheck:strict
   npm run build
   ```
   *Critério de Invalidação*: Se qualquer um desses comandos falhar com erros de sintaxe ou tipo.

2. **Validação da Suíte de Testes de Concorrência e Marketplace**:
   ```powershell
   npx vitest run src/tests/marketplace-concurrency-simulation.test.ts src/tests/marketplace-returns-exchanges-atomicity.test.ts src/tests/marketplace-checkout-concurrency-audit.test.ts src/tests/marketplace-checkout-pricing.test.ts src/tests/marketplace-pricing-integrity.test.ts
   ```
   *Critério de Invalidação*: Se qualquer um dos 129 testes falhar.

3. **Inspeção dos Arquivos com Achados**:
   - `src/components/client/store/ProductPage.tsx:508-531` (filtro sem `produto_variante_id`).
   - `src/components/client/store/CheckoutPage.tsx:1030-1049` (verificação de estoque sem variante).
   - `src/components/client/store/CheckoutPage.tsx:1190-1199` (ausência de `fetchCartItems` no catch).
   - `src/components/client/store/CheckoutPage.tsx:3-9` (10 ícones Lucide não utilizados).
   - `src/components/admin/LojaTrocasModule.tsx:38-51` (`[activeTab, search]` no Realtime) e linhas 28/362/372 (`page` sem fetch).
