docker exec -i gsa-tv-control-plane node -e "
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const q = await p.query(\`select config->'broadcast_schedule_policy' as policy from gsa_tv_channels where id='ch-main'\`);
  console.log(q.rows);
  await p.end();
})().catch(e => { console.error(e); process.exit(1); });
"
