docker exec -i gsa-tv-control-plane node -e "
const {Pool} = require('pg');
const p = new Pool({connectionString: process.env.DATABASE_URL});
p.query(\"select id, is_reprise, metadata, block_type from gsa_tv_program_blocks where id='a782f8bb-1585-4eca-93e2-673ffa8211a0'\").then(r => {
  console.log(JSON.stringify(r.rows, null, 2));
  p.end();
}).catch(e => { console.error(e); p.end(); });
"
