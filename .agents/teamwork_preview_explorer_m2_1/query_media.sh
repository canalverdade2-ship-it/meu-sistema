docker exec -i gsa-tv-control-plane node -e "
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const r = await p.query(\"select id, title, duration_s, state, approval_state, rights_ok, drive_path, metadata->>'program_slug' as slug, metadata->>'program_id' as program_id, metadata->>'broadcast_date' as bdate from gsa_tv_media_items where channel_id='ch-main' order by updated_at desc limit 40\");
  console.log('ID | Title | Dur(s) | State | Approval | Rights | Slug | BDate | DrivePath');
  console.log('---|---|---|---|---|---|---|---|---');
  r.rows.forEach(m => {
    console.log([m.id, m.title, m.duration_s, m.state, m.approval_state, m.rights_ok, m.slug || '-', m.bdate || '-', m.drive_path].join(' | '));
  });
  await p.end();
})().catch(e => { console.error(e); process.exit(1); });
"
