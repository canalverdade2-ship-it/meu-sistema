#!/usr/bin/env bash
docker exec -i gsa-tv-control-plane node -e '
const {Pool} = require("pg");
const p = new Pool({connectionString: process.env.DATABASE_URL});
(async () => {
  const cols = await p.query("select column_name from information_schema.columns where table_name=\x27gsa_tv_ai_provider_secrets\x27");
  console.log("COLUMNS:", cols.rows.map(x=>x.column_name));
  const rows = await p.query("select * from gsa_tv_ai_provider_secrets");
  for (const r of rows.rows) {
    console.log("ROW:", {
      channel_id: r.channel_id,
      provider: r.provider,
      default_model: r.default_model,
      speech_model: r.speech_model,
      updated_at: r.updated_at
    });
  }
  await p.end();
})().catch(e => { console.error(e); process.exit(1); });
'
