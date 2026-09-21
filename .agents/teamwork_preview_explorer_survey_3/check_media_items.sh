docker exec -i gsa-tv-control-plane node -e "
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const m = await p.query(\"select id, title, duration_s, state, approval_state, rights_ok, media_kind, drive_path, metadata->>'broadcast_date' as broadcast_date, metadata->>'program_slug' as program_slug from gsa_tv_media_items where channel_id='ch-main' order by updated_at desc limit 50\");
  console.log('Total recent items:', m.rows.length);
  console.log(JSON.stringify(m.rows, null, 2));
  await p.end();
})().catch(e => { console.error(e); process.exit(1); });
"
