import { runSshScript } from './ssh2-run.mjs';

async function main() {
  try {
    const res = await runSshScript(`
      sudo -u postgres psql -p 5433 -d gsahub -c "
        SELECT 
          c.relname,
          c.relrowsecurity,
          c.relforcerowsecurity,
          pg_get_userbyid(c.relowner) AS owner
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'system_settings';
      "
      sudo -u postgres psql -p 5433 -d gsahub -c "
        SELECT polname, polpermissive, polroles, polcmd, pg_get_expr(polqual, polrelid) as qual 
        FROM pg_policy 
        WHERE polrelid = 'public.system_settings'::regclass;
      "
    `, 20000);
    console.log(res.stdout);
    if (res.stderr) console.error('STDERR:', res.stderr);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();
