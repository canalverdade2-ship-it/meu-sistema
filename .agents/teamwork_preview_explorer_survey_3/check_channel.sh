docker exec -i gsa-tv-control-plane node -e "
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const c = await p.query(\"select id, name, config from gsa_tv_channels where id='ch-main'\");
  console.log(JSON.stringify(c.rows[0], null, 2));
  await p.end();
})().catch(e => { console.error(e); process.exit(1); });
"
