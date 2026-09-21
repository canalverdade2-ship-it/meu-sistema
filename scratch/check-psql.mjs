import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const cmd = `sudo docker exec gsa-tv-postgres psql -U postgres -d postgres -c "SELECT channel_id, provider FROM public.gsa_tv_ai_provider_secrets;" 2>&1 || sudo docker exec gsa-tv-postgres psql -U gsatv -d gsa_tv -c "SELECT channel_id, provider FROM public.gsa_tv_ai_provider_secrets;" 2>&1`;
  const res = await runSshScript(cmd);
  console.log('OUTPUT:\n', res.stdout, res.stderr);
}

main().catch(console.error);
