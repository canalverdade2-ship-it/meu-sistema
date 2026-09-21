import { runSshScript } from './ssh2-run.mjs';

async function main() {
  try {
    const res = await runSshScript(`
      sudo -u postgres psql -p 5433 -d gsahub -c "
        SELECT polname, pg_get_expr(polqual, polrelid) as qual 
        FROM pg_policy 
        WHERE polrelid = 'public.system_settings'::regclass AND polname = 'system_settings_public_read';
      "
    `, 20000);
    console.log(res.stdout);
    if (res.stderr) console.error('STDERR:', res.stderr);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();
