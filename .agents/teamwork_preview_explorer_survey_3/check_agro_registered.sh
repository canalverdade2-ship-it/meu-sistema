docker exec -i gsa-tv-control-plane node -e "
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const r = await p.query(\"select * from gsa_tv_media_items where id='media-master-gsa-agro-2026-09-15-818ad89d-a679-431d-8962-4e16fb769899'\");
  console.log(JSON.stringify(r.rows, null, 2));
  await p.end();
})().catch(e => { console.error(e); process.exit(1); });
"
