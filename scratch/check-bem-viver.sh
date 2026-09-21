docker exec gsa-tv-control-plane node -e "
const { Pool } = require('pg');
(async () => {
  const p = new Pool({ connectionString: process.env.DATABASE_URL });
  const r = await p.query(\"select id,title,duration_s,drive_path,state,approval_state,rights_ok,metadata from gsa_tv_media_items where id='media-auto-2712832c-219b-4eb3-93ba-17a9311728c3'\");
  console.log(JSON.stringify(r.rows, null, 2));
  await p.end();
})();
"
