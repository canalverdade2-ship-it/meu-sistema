import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
    psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -c "
      DELETE FROM public.gsa_tv_media_items WHERE id='media-purge-test-999';
      DELETE FROM public.gsa_tv_jobs WHERE payload->>'media_id' = 'media-purge-test-999';
    "
  `;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
