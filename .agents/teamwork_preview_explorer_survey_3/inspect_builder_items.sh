docker exec -i gsa-tv-control-plane node -e "
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const r = await p.query(\"select id, title, duration_s, state, approval_state, rights_ok, drive_path, metadata from gsa_tv_media_items where id in ('media-builder-news-0909', 'media-builder-hist-0909', 'media-ent-desenhos-betty-boop', 'media-ent-pipoca-sexta')\");
  console.log(JSON.stringify(r.rows, null, 2));
  await p.end();
})().catch(e => { console.error(e); process.exit(1); });
"
