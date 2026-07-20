const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:%40Ad98653200%40@db.ocgajvagxagutfvgxwsy.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();
  const invoiceId = process.argv[2];
  const invoice = await client.query(
    `select id, codigo_fatura, valor_total, ordem_compra_id, ordem_assinatura_id, itens_faturados, created_at
     from faturas
     where id = $1`,
    [invoiceId]
  );
  console.log('FATURA');
  console.log(JSON.stringify(invoice.rows, null, 2));

  const orderIds = invoice.rows.flatMap((row) => [row.ordem_compra_id, row.ordem_assinatura_id].filter(Boolean));
  if (orderIds.length > 0) {
    const orders = await client.query(
      `select 'oc' as origem, oc.*, row_to_json(p.*) as produto
       from ordens_compra oc
       left join produtos p on p.id = oc.produto_id
       where oc.id = any($1::uuid[])
       union all
       select 'oa' as origem, oa.*, row_to_json(a.*) as produto
       from ordens_assinatura oa
       left join assinaturas a on a.id = oa.assinatura_id
       where oa.id = any($1::uuid[])`,
      [orderIds]
    );
    console.log('ORDENS VINCULADAS');
    console.log(JSON.stringify(orders.rows, null, 2));
  }

  const code = invoice.rows[0]?.codigo_fatura;
  const columns = await client.query(
    `select column_name, data_type
     from information_schema.columns
     where table_schema = 'public' and table_name = 'orcamentos'
     order by ordinal_position`
  );
  console.log('COLUNAS ORCAMENTOS');
  console.log(JSON.stringify(columns.rows, null, 2));

  const relatedTables = await client.query(
    `select table_name
     from information_schema.tables
     where table_schema = 'public'
       and (
         table_name ilike '%item%'
         or table_name ilike '%pedido%'
         or table_name ilike '%loja%'
         or table_name ilike '%ordem%'
         or table_name ilike '%cart%'
       )
     order by table_name`
  );
  console.log('TABELAS RELACIONADAS A ITENS/PEDIDOS');
  console.log(JSON.stringify(relatedTables.rows, null, 2));

  const orderCode = process.argv[3];
  if (orderCode) {
    const orcamentos = await client.query(
      `select *
       from orcamentos
       where codigo_orcamento = $1 or codigo_orcamento = $2
       order by data_criacao desc nulls last
       limit 3`,
      [orderCode, orderCode.replace(/^#/, '')]
    );
    console.log('ORCAMENTOS PELO CODIGO DO PEDIDO');
    console.log(JSON.stringify(orcamentos.rows, null, 2));

    const orcamentoIds = orcamentos.rows.map((row) => row.id);
    if (orcamentoIds.length > 0) {
      const ocs = await client.query(
        `select oc.*, row_to_json(p.*) as produto
         from ordens_compra oc
         left join produtos p on p.id = oc.produto_id
         where oc.orcamento_id = any($1::uuid[])`,
        [orcamentoIds]
      );
      console.log('ORDENS COMPRA DO ORCAMENTO');
      console.log(JSON.stringify(ocs.rows, null, 2));

      const oas = await client.query(
        `select oa.*, row_to_json(a.*) as assinatura
         from ordens_assinatura oa
         left join assinaturas a on a.id = oa.assinatura_id
         where oa.orcamento_id = any($1::uuid[])`,
        [orcamentoIds]
      );
      console.log('ORDENS ASSINATURA DO ORCAMENTO');
      console.log(JSON.stringify(oas.rows, null, 2));

      const carrinhoColumns = await client.query(
        `select column_name, data_type
         from information_schema.columns
         where table_schema = 'public' and table_name = 'loja_carrinhos'
         order by ordinal_position`
      );
      console.log('COLUNAS LOJA_CARRINHOS');
      console.log(JSON.stringify(carrinhoColumns.rows, null, 2));

      const carrinhos = await client.query(
        `select *
         from loja_carrinhos
         where cliente_id = $1
         limit 20`,
        [orcamentos.rows[0].cliente_id]
      );
      console.log('CARRINHO RECENTE DO CLIENTE');
      console.log(JSON.stringify(carrinhos.rows, null, 2));
    }
  } else if (code) {
    console.log('CODIGO FATURA');
    console.log(code);
  }

  await client.end();
}

run().catch(async (error) => {
  console.error(error);
  await client.end().catch(() => {});
  process.exit(1);
});
