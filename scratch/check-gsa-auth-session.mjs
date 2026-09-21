import { runSshScript } from './ssh2-run.mjs';

async function main() {
  try {
    const res = await runSshScript(`
      PGPASSWORD='GSA_SENHA_FORTE_2026' psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -c "
        DROP POLICY IF EXISTS gsa_provider_registration_challenges_service_only ON public.gsa_provider_registration_challenges;
        CREATE POLICY gsa_provider_registration_challenges_service_only ON public.gsa_provider_registration_challenges
          FOR ALL TO service_role USING (true) WITH CHECK (true);
      "
      PGPASSWORD='GSA_SENHA_FORTE_2026' psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -c "SELECT tablename, policyname, roles, cmd FROM pg_policies WHERE tablename = 'gsa_provider_registration_challenges';"
    `, 30000);
    console.log(res.stdout);
    if (res.stderr) console.error('STDERR:', res.stderr);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();
