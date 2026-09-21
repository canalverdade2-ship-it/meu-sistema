const { createClient } = require('@supabase/supabase-js');
const url = 'https://api.147-15-43-141.nip.io';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzczOTU2NDA5LCJleHAiOjIwODk1MzI0MDl9.05kQchOXKH2S062F8SJsb-bmnh3pni-RJE1P0jo0Igs';

const supabase = createClient(url, key);

async function backfill() {
  console.log('Fetching faturas to backfill...');
  const { data: faturas, error: fError } = await supabase
    .from('faturas')
    .select(`
      id,
      codigo_fatura,
      orcamento_id,
      ordem_compra_id,
      itens_faturados,
      valor_total,
      orcamentos (
        id,
        codigo_orcamento,
        total,
        subtotal_itens,
        subtotal_preco_tabela,
        desconto_produtos,
        desconto_promocional,
        desconto_cupom,
        desconto_pontos,
        abatimento_carteira,
        taxa_entrega,
        acrescimo,
        forma_pagamento_loja,
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
        ),
        loja_pedido_itens (
          id,
          nome,
          codigo,
          tipo,
          valor_unitario,
          quantidade,
          subtotal,
          is_brinde,
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
    `);

  if (fError) {
    console.error('Error fetching faturas:', fError);
    return;
  }

  console.log(`Found ${faturas.length} faturas.`);

  for (const fat of faturas) {
    const orc = fat.orcamentos;
    if (!orc) continue;

    let items = [];
    if (Array.isArray(orc.loja_pedido_itens) && orc.loja_pedido_itens.length > 0) {
      items = orc.loja_pedido_itens.map(li => ({
        nome: li.nome,
        descricao: li.nome,
        codigo: li.codigo || (li.produtos?.codigo_produto || ''),
        quantidade: li.quantidade || 1,
        valor_unitario: Number(li.valor_unitario || li.produtos?.valor || 0),
        subtotal: Number(li.subtotal || ((li.valor_unitario || li.produtos?.valor || 0) * (li.quantidade || 1))),
        imagem_url: li.produtos?.imagem_url || null,
        tipo: li.tipo || 'produto'
      }));
    } else if (Array.isArray(orc.ordens_compra) && orc.ordens_compra.length > 0) {
      items = orc.ordens_compra.map(oc => ({
        nome: oc.produtos?.nome || 'Produto',
        descricao: oc.produtos?.nome || 'Produto',
        codigo: oc.produtos?.codigo_produto || oc.codigo_ordem || '',
        quantidade: oc.quantidade || 1,
        valor_unitario: Number(oc.produtos?.valor || 0),
        subtotal: Number((oc.produtos?.valor || 0) * (oc.quantidade || 1)),
        imagem_url: oc.produtos?.imagem_url || null,
        tipo: 'produto'
      }));
    }

    const firstOcId = orc.ordens_compra?.[0]?.id || null;
    const subtotal = Number(orc.subtotal_preco_tabela || orc.subtotal_itens || fat.valor_total || 0);
    const descCupom = Number(orc.desconto_cupom || 0);
    const descPontos = Number(orc.desconto_pontos || 0);
    const descPromo = Number(orc.desconto_promocional || orc.desconto_produtos || 0);
    const abatCarteira = Number(orc.abatimento_carteira || 0);
    const formaPag = orc.forma_pagamento_loja || 'pix';

    const updates = {
      ordem_compra_id: fat.ordem_compra_id || firstOcId,
      itens_faturados: items.length > 0 ? items : (fat.itens_faturados || []),
      valor_base_original: subtotal,
      desconto_promocional_aplicado: descPromo,
      desconto_voucher_aplicado: descCupom,
      desconto_pontos_aplicado: descPontos,
      abatimento_carteira_aplicado: abatCarteira,
      forma_pagamento_escolhida: formaPag
    };

    console.log(`Updating fatura ${fat.codigo_fatura} (${fat.id})...`);
    const { error: updErr } = await supabase
      .from('faturas')
      .update(updates)
      .eq('id', fat.id);

    if (updErr) {
      console.error(`Error updating ${fat.codigo_fatura}:`, updErr);
    } else {
      console.log(`Updated ${fat.codigo_fatura} successfully!`);
    }
  }

  console.log('Backfill complete!');
}

backfill();
