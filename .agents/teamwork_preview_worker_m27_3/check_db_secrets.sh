#!/usr/bin/env bash
docker exec -i gsa-tv-control-plane node -e "
const {Pool} = require('/app/node_modules/pg');
(async () => {
  const pool = new Pool({connectionString: process.env.DATABASE_URL});
  const rows = (await pool.query('select * from gsa_tv_ai_provider_secrets')).rows;
  console.log('Provider secrets rows:', rows.map(r => ({ id: r.id, provider: r.provider, default_model: r.default_model, speech_model: r.speech_model })));
  await pool.end();
})();
"
