const { Client } = require('pg');

const connectionString = process.env.SUPABASE_DB_URL || 'postgresql://postgres:%40Ad98653200%40@db.ocgajvagxagutfvgxwsy.supabase.co:5432/postgres';

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  const result = await client.query(`
    select p.proname, pg_get_functiondef(p.oid) as definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'admin_processar_saque',
        'admin_processar_transferencia',
        'solicitar_saque_seguro',
        'cancelar_saque_seguro',
        'estornar_transferencia_seguro'
      )
    order by p.proname, p.oid
  `);

  for (const row of result.rows) {
    console.log(`\n--- ${row.proname} ---\n`);
    console.log(row.definition);
  }

  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
