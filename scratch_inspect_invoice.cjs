require('dotenv').config();

const { Client } = require('pg');

const connectionString = process.env.SUPABASE_DB_URL;
const invoiceId = process.argv[2];

if (!connectionString) {
  console.error('SUPABASE_DB_URL não configurada. Operação cancelada.');
  process.exit(1);
}

if (!invoiceId) {
  console.error('Uso: node scratch_inspect_invoice.cjs <fatura_id> [codigo_orcamento]');
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();
  const invoice = await client.query(
    `SELECT id, codigo_fatura, valor_total, ordem_compra_id, ordem_assinatura_id, itens_faturados, created_at
     FROM faturas
     WHERE id = $1`,
    [invoiceId],
  );
  console.log('FATURA');
  console.log(JSON.stringify(invoice.rows, null, 2));

  const orderIds = invoice.rows.flatMap((row) => [row.ordem_compra_id, row.ordem_assinatura_id].filter(Boolean));
  if (orderIds.length > 0) {
    const orders = await client.query(
      `SELECT 'oc' AS origem, oc.*, row_to_json(p.*) AS produto
       FROM ordens_compra oc
       LEFT JOIN produtos p ON p.id = oc.produto_id
       WHERE oc.id = ANY($1::uuid[])
       UNION ALL
       SELECT 'oa' AS origem, oa.*, row_to_json(a.*) AS produto
       FROM ordens_assinatura oa
       LEFT JOIN assinaturas a ON a.id = oa.assinatura_id
       WHERE oa.id = ANY($1::uuid[])`,
      [orderIds],
    );
    console.log('ORDENS VINCULADAS');
    console.log(JSON.stringify(orders.rows, null, 2));
  }

  const code = invoice.rows[0]?.codigo_fatura;
  const columns = await client.query(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'orcamentos'
     ORDER BY ordinal_position`,
  );
  console.log('COLUNAS ORCAMENTOS');
  console.log(JSON.stringify(columns.rows, null, 2));

  const relatedTables = await client.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND (
         table_name ILIKE '%item%'
         OR table_name ILIKE '%pedido%'
         OR table_name ILIKE '%loja%'
         OR table_name ILIKE '%ordem%'
         OR table_name ILIKE '%cart%'
       )
     ORDER BY table_name`,
  );
  console.log('TABELAS RELACIONADAS A ITENS/PEDIDOS');
  console.log(JSON.stringify(relatedTables.rows, null, 2));

  const orderCode = process.argv[3];
  if (orderCode) {
    const orcamentos = await client.query(
      `SELECT *
       FROM orcamentos
       WHERE codigo_orcamento = $1 OR codigo_orcamento = $2
       ORDER BY data_criacao DESC NULLS LAST
       LIMIT 3`,
      [orderCode, orderCode.replace(/^#/, '')],
    );
    console.log('ORCAMENTOS PELO CODIGO DO PEDIDO');
    console.log(JSON.stringify(orcamentos.rows, null, 2));

    const orcamentoIds = orcamentos.rows.map((row) => row.id);
    if (orcamentoIds.length > 0) {
      const ocs = await client.query(
        `SELECT oc.*, row_to_json(p.*) AS produto
         FROM ordens_compra oc
         LEFT JOIN produtos p ON p.id = oc.produto_id
         WHERE oc.orcamento_id = ANY($1::uuid[])`,
        [orcamentoIds],
      );
      console.log('ORDENS COMPRA DO ORCAMENTO');
      console.log(JSON.stringify(ocs.rows, null, 2));

      const oas = await client.query(
        `SELECT oa.*, row_to_json(a.*) AS assinatura
         FROM ordens_assinatura oa
         LEFT JOIN assinaturas a ON a.id = oa.assinatura_id
         WHERE oa.orcamento_id = ANY($1::uuid[])`,
        [orcamentoIds],
      );
      console.log('ORDENS ASSINATURA DO ORCAMENTO');
      console.log(JSON.stringify(oas.rows, null, 2));

      const carrinhoColumns = await client.query(
        `SELECT column_name, data_type
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'loja_carrinhos'
         ORDER BY ordinal_position`,
      );
      console.log('COLUNAS LOJA_CARRINHOS');
      console.log(JSON.stringify(carrinhoColumns.rows, null, 2));

      const carrinhos = await client.query(
        `SELECT *
         FROM loja_carrinhos
         WHERE cliente_id = $1
         LIMIT 20`,
        [orcamentos.rows[0].cliente_id],
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
  console.error('Erro ao inspecionar fatura:', error);
  await client.end().catch(() => {});
  process.exit(1);
});
