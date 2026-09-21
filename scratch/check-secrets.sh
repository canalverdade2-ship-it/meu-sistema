docker exec gsa-tv-control-plane node -e "
const { Pool } = require('pg');
(async () => {
  const p = new Pool({ connectionString: process.env.DATABASE_URL });
  const r = await p.query('select provider, default_model, speech_model from gsa_tv_ai_provider_secrets');
  console.log(JSON.stringify(r.rows, null, 2));
  await p.end();
})();
"
