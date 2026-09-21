docker exec gsa-tv-control-plane node -e "
const { Pool } = require('pg');
(async () => {
  const p = new Pool({ connectionString: process.env.DATABASE_URL });
  const r = await p.query(\"select id, title, duration_s, state, approval_state, rights_ok from gsa_tv_media_items where channel_id='ch-main' and (metadata->>'broadcast_date'='2026-09-15' or title like '%2026-09-15%') order by title\");
  console.log(JSON.stringify(r.rows, null, 2));
  console.log('Total items:', r.rows.length);
  await p.end();
})();
"
