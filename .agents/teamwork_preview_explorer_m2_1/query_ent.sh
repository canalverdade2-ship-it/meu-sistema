docker exec -i gsa-tv-control-plane node -e "
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const r = await p.query(\"select id, title, duration_s, state, approval_state, rights_ok, metadata from gsa_tv_media_items where id like 'media-ent%' or id like '%continuity%' or id like '%fallback%'\");
  r.rows.forEach(m => {
    console.log(m.id, '-> slug:', m.metadata?.program_slug, 'program_id:', m.metadata?.program_id, 'approval:', m.approval_state, 'rights:', m.rights_ok, 'dur:', m.duration_s);
  });
  await p.end();
})().catch(e => { console.error(e); process.exit(1); });
"
