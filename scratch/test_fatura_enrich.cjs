const { createClient } = require('@supabase/supabase-js');
const url = 'https://api.147-15-43-141.nip.io';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzczOTU2NDA5LCJleHAiOjIwODk1MzI0MDl9.05kQchOXKH2S062F8SJsb-bmnh3pni-RJE1P0jo0Igs';

const supabase = createClient(url, key);

async function run() {
  const { data: fat, error } = await supabase
    .from('faturas')
    .select(`
      *,
      orcamentos:orcamento_id (
        id,
        codigo_orcamento,
        status,
        status_entrega,
        rastreio_codigo,
        total,
        subtotal_itens,
        subtotal_preco_tabela,
        desconto_produtos,
        desconto_promocional,
        desconto_cupom,
        desconto_pontos,
        abatimento_carteira,
        desconto,
        taxa_entrega,
        acrescimo,
        valor_servico,
        valor_produto,
        valor_assinatura,
        valor_adicional,
        descricao_adicional,
        forma_pagamento_loja,
        endereco_entrega,
        cupom_desconto_id,
        cupom_entrega_id,
        loja_pedido_itens (
          id,
          nome,
          codigo,
          tipo,
          valor_unitario,
          quantidade,
          subtotal,
          is_brinde,
          produto_id,
          assinatura_id,
          produtos (
            id,
            nome,
            imagem_url,
            codigo_produto,
            codigo_barras,
            valor,
            valor_promocional
          )
        ),
        ordens_compra (
          id,
          codigo_ordem,
          quantidade,
          produtos (
            id,
            nome,
            imagem_url,
            codigo_produto,
            codigo_barras,
            valor
          )
        )
      )
    `)
    .eq('id', 'c0ee8a8c-90eb-44d7-8b99-14e8fa8b3cd7')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Enriched fatura:');
  console.log(JSON.stringify(fat, null, 2));
}

run();
