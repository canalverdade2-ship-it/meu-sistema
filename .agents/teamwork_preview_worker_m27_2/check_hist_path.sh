docker exec -i gsa-tv-control-plane node -e "
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const q = await p.query('select id, title, drive_path, duration_s, state, approval_state, rights_ok, metadata from gsa_tv_media_items where id = \$1', ['media-builder-hist-0909']);
  console.log(JSON.stringify(q.rows, null, 2));
  await p.end();
})().catch(e => { console.error(e); process.exit(1); });
"
