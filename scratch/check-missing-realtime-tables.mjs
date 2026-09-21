import { runSshScript } from './ssh2-run.mjs';

async function main() {
  try {
    const res = await runSshScript(`
      sudo -u postgres psql -p 5433 -d gsahub -c "
        -- Tabelas do public que NÃO estão na publicação supabase_realtime
        SELECT t.table_name
        FROM information_schema.tables t
        LEFT JOIN pg_publication_tables p 
          ON p.schemaname = 'public' 
          AND p.tablename = t.table_name 
          AND p.pubname = 'supabase_realtime'
        WHERE t.table_schema = 'public' 
          AND t.table_type = 'BASE TABLE'
          AND p.tablename IS NULL
        ORDER BY t.table_name;
      "
    `, 20000);
    console.log(res.stdout);
    if (res.stderr) console.error('STDERR:', res.stderr);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();
