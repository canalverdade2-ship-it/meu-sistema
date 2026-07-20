require('dotenv').config();

const { Client } = require('pg');

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error('SUPABASE_DB_URL não configurada. Operação cancelada.');
  process.exit(1);
}

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const result = await client.query(`
      SELECT p.proname, pg_get_functiondef(p.oid) AS definition
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN (
          'admin_processar_saque',
          'admin_processar_transferencia',
          'solicitar_saque_seguro',
          'cancelar_saque_seguro',
          'estornar_transferencia_seguro'
        )
      ORDER BY p.proname, p.oid
    `);

    for (const row of result.rows) {
      console.log(`\n--- ${row.proname} ---\n`);
      console.log(row.definition);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Erro ao inspecionar RPCs financeiras:', error);
  process.exit(1);
});
