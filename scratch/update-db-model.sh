docker exec gsa-tv-control-plane node -e "
const { Pool } = require('pg');
(async () => {
  const p = new Pool({ connectionString: process.env.DATABASE_URL });
  const r = await p.query(\"update gsa_tv_ai_provider_secrets set default_model='gemini-3.1-flash-lite', updated_at=now() where channel_id='ch-main' returning channel_id, provider, default_model\");
  console.log('Updated secrets:', JSON.stringify(r.rows, null, 2));
  await p.end();
})();
"
