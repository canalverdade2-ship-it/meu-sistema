docker exec -i gsa-tv-control-plane node -e "
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const ids = [
    'media-ent-desenhos-sabado',
    'media-ent-desenhos-domingo',
    'media-ent-pipoca-sabado',
    'media-ent-pipoca-domingo',
    'media-builder-hist-0909',
    'media-gsa-tv-continuity-600',
    'media-gsa-tv-official-continuity',
    'media-gsa-em-fe-15h-10min',
    'media-builder-508efc15-9d82-4d01-a0b8-4c332ec9eb73',
    'media-ent-desenhos-quinta',
    'media-ent-pipoca-quinta'
  ];
  const q = await p.query(\`
    select id, title, duration_s, state, approval_state, rights_ok, rights_expires_at, drive_path, media_kind, source_type, metadata
    from gsa_tv_media_items
    where id = any(\$1)
  \`, [ids]);
  console.log(JSON.stringify(q.rows, null, 2));
  await p.end();
})().catch(e => { console.error(e); process.exit(1); });
"
