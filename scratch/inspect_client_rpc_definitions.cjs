const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config();

function connectionString() {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  const source = fs.readFileSync('apply_pg_migration.cjs', 'utf8');
  const match = source.match(/process\.env\.SUPABASE_DB_URL\s*\|\|\s*'([^']+)'/);
  if (!match) throw new Error('Defina SUPABASE_DB_URL.');
  return match[1];
}

const defaultNames = [
  'checkout_pedido', 'cancelar_pedido_loja', 'gerar_fatura_pedido_store', 'solicitar_troca',
  'estornar_transferencia_cliente', 'converter_pontos_cliente', 'aprovar_orcamento_cliente',
  'aceitar_quitacao_credito_loja', 'aceitar_quitacao_emprestimo', 'gerar_fatura_parcela_emprestimo',
  'prorrogar_assinatura_cliente', 'assinar_area_vip_cliente', 'solicitar_saque_cliente',
  'cancelar_saque_cliente', 'solicitar_transferencia_cliente', 'cancelar_transferencia_cliente',
  'resgatar_voucher_carteira', 'suprimir_bonus_boas_vindas_cliente',
  'processar_bonus_boas_vindas_seguro', 'liberar_credito_loja_assinado'
];
const names = process.argv.length > 2 ? process.argv.slice(2) : defaultNames;

async function main() {
  const client = new Client({ connectionString: connectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const { rows } = await client.query(`
      select p.proname, pg_get_function_identity_arguments(p.oid) as args,
             pg_get_function_result(p.oid) as result,
             pg_get_functiondef(p.oid) as definition,
             array_to_string(p.proacl, ',') as grants
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = any($1::text[])
       order by p.proname, args
    `, [names]);
    for (const row of rows) {
      console.log(`\n===== ${row.proname}(${row.args}) -> ${row.result} =====`);
      console.log(`GRANTS: ${row.grants || '(default/public)'}`);
      console.log(row.definition);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
