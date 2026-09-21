import { runSshScript } from './ssh2-run.mjs';

async function cleanAiSecrets() {
  const script = `
sudo docker exec gsa-tv-control-plane node -e '
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
  try {
    const res = await pool.query("SELECT channel_id, provider, created_at FROM public.gsa_tv_ai_provider_secrets");
    console.log("Found AI provider secrets in DB:", res.rows);
    if (res.rows.length > 0) {
      await pool.query("DELETE FROM public.gsa_tv_ai_provider_secrets WHERE provider = \\$1", ["gemini"]);
      console.log("DELETED Gemini secrets from public.gsa_tv_ai_provider_secrets!");
    }
  } catch(e) {
    console.error("DB error:", e.message);
  } finally {
    await pool.end();
  }
}
run();
'
`;
  const res = await runSshScript(script);
  console.log('STDOUT:\n', res.stdout);
}

cleanAiSecrets().catch(console.error);
