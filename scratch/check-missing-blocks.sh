docker exec gsa-tv-control-plane node -e "
const { Pool } = require('pg');
(async () => {
  const p = new Pool({ connectionString: process.env.DATABASE_URL });
  const v = (await p.query(\"select id from gsa_tv_schedule_versions where broadcast_date='2026-09-15' and state='published' order by version desc limit 1\")).rows[0].id;
  const r = await p.query(\"select b.id, b.planned_start_offset_s, b.planned_duration_s, b.media_item_id, p.name from gsa_tv_program_blocks b left join gsa_tv_programs p on p.id=b.program_id where b.schedule_version_id=$1 and b.media_item_id is null order by b.planned_start_offset_s\", [v]);
  console.log(JSON.stringify(r.rows, null, 2));
  await p.end();
})();
"
