docker exec -i gsa-tv-control-plane node -e "
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const r = await p.query(\"select distinct title, id, drive_path from gsa_tv_media_items where channel_id='ch-main' order by title\");
  r.rows.forEach(m => {
    console.log(m.id, '|', m.title, '|', m.drive_path);
  });
  await p.end();
})().catch(e => { console.error(e); process.exit(1); });
"
