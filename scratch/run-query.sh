docker exec -i gsa-tv-control-plane node -e "
const {Pool} = require('pg');
const p = new Pool({connectionString: process.env.DATABASE_URL});
async function main() {
  const r = await p.query(\"select b.id, b.program_id, b.media_item_id, p.name from gsa_tv_program_blocks b left join gsa_tv_programs p on p.id=b.program_id where b.id='0f2f9292-a83b-462b-aab7-b09cbff27b8a'\");
  console.log('BLOCK:', JSON.stringify(r.rows, null, 2));
  if (r.rows.length && r.rows[0].media_item_id) {
    const m = await p.query(\"select id, title, state, approval_state, rights_ok, duration_s, drive_path, metadata from gsa_tv_media_items where id=$1\", [r.rows[0].media_item_id]);
    console.log('LINKED MEDIA:', JSON.stringify(m.rows, null, 2));
  }
  const allM = await p.query(\"select id, title, state, approval_state, rights_ok, duration_s, drive_path, metadata from gsa_tv_media_items where metadata->>'program_slug'='gsa-ta-na-rede' or title ilike '%tá na rede%'\");
  console.log('ALL CANDIDATES:', JSON.stringify(allM.rows, null, 2));
  await p.end();
}
main().catch(console.error);
"
