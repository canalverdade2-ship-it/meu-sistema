#!/usr/bin/env bash
docker exec -i gsa-tv-control-plane node -e "
const {Pool} = require('/app/node_modules/pg');
(async () => {
  const pool = new Pool({connectionString: process.env.DATABASE_URL});
  const row = (await pool.query(\"select provider, default_model, speech_model, updated_at from gsa_tv_ai_provider_secrets where channel_id='ch-main' order by updated_at desc limit 1\")).rows[0];
  console.log('Provider secret row:', row);
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
"
