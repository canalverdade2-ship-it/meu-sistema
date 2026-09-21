docker exec -i gsa-tv-control-plane node -e "
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const ids = [
    'media-ent-desenhos-sabado',
    'media-ent-pipoca-sabado',
    'media-library-em-fe-1800s',
    'media-library-music-1800s',
    'media-auto-ad31636f-c7c7-4aa8-a6ae-8add00139bdc',
    'media-gsa-tv-continuity-600'
  ];
  const q = await p.query('select id, title, drive_path, duration_s, state, approval_state, rights_ok, metadata from gsa_tv_media_items where id = ANY(\$1)', [ids]);
  console.log(JSON.stringify(q.rows, null, 2));
  await p.end();
})().catch(e => { console.error(e); process.exit(1); });
"
