docker exec -i gsa-tv-control-plane node -e "
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const r = await p.query(\"select id, title, duration_s, state, approval_state, rights_ok, drive_path, metadata from gsa_tv_media_items where channel_id='ch-main' and (title ilike '%desenhos%' or title ilike '%pipoca%' or title ilike '%cinema%' or title ilike '%música%' or title ilike '%music%' or title ilike '%fé%' or title ilike '%continuidade%')\");
  r.rows.forEach(m => {
    console.log(m.id, '|', m.title, '| dur:', m.duration_s, '|', m.state, '|', m.approval_state, '| rights:', m.rights_ok, '| drive:', m.drive_path);
  });
  await p.end();
})().catch(e => { console.error(e); process.exit(1); });
"
