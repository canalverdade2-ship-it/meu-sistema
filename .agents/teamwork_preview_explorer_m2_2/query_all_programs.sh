docker exec -i gsa-tv-control-plane node -e "
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const q = await p.query(\`select * from gsa_tv_programs\`);
  console.log(JSON.stringify(q.rows, null, 2));
  await p.end();
})().catch(e => { console.error(e); process.exit(1); });
"
