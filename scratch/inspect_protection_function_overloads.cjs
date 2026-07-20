const { Client } = require('pg');

const names = [
  'gsa_admin_criar_proposta_saude',
  'gsa_client_aceitar_proposta_saude',
  'gsa_client_checkout_saude_assessoria',
  'gsa_client_saude_aceitar_proposta',
  'gsa_client_saude_criar_cotacao',
];

async function main() {
  if (!process.env.SUPABASE_DB_URL) throw new Error('SUPABASE_DB_URL is required.');
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  });
  await client.connect();
  try {
    const { rows } = await client.query(`
      SELECT p.proname AS function_name,
             pg_get_function_identity_arguments(p.oid) AS arguments,
             p.prosecdef AS security_definer,
             has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
             has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
             pg_get_functiondef(p.oid) AS definition
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = ANY($1::text[])
      ORDER BY p.proname, pg_get_function_identity_arguments(p.oid)
    `, [names]);
    for (const row of rows) {
      console.log(`\n-- ${row.function_name}(${row.arguments}) security_definer=${row.security_definer} anon=${row.anon_execute} authenticated=${row.authenticated_execute}`);
      console.log(row.definition);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
