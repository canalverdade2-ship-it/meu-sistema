#!/usr/bin/env bash
echo "=== PID 82070 STATUS ==="
ps aux | grep 82070 | grep -v grep || echo "PID 82070 is not running"

echo -e "\n=== ACTIVE DOCKER PROCESSES ==="
docker ps

echo -e "\n=== RUNTIME PRODUCTION JSON ==="
cat /opt/gsa-tv/runtime/production/2026-09-15.json

echo -e "\n=== RECENT EXECUTION LOG ==="
tail -n 25 /opt/gsa-tv/runtime/production/2026-09-15-execution.log

echo -e "\n=== AI PROVIDER SECRETS ==="
docker exec -i gsa-tv-control-plane node -e '
const {Pool} = require("pg");
const p = new Pool({connectionString: process.env.DATABASE_URL});
p.query("select id, channel_id, provider, default_model, speech_model, updated_at from gsa_tv_ai_provider_secrets").then(r => {
  console.log(JSON.stringify(r.rows, null, 2));
  p.end();
});
'
