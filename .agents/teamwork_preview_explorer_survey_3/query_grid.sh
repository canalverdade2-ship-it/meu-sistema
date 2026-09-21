docker exec -i gsa-tv-control-plane node -e "
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const v = await p.query(\"select * from gsa_tv_schedule_versions where broadcast_date='2026-09-15' order by version desc\");
  console.log('=== VERSIONS ===');
  console.log(JSON.stringify(v.rows, null, 2));
  if (v.rows.length === 0) return;
  const versionId = v.rows[0].id;
  const b = await p.query(\"select b.id, b.schedule_version_id, b.program_id, b.planned_start_offset_s, b.planned_duration_s, b.media_item_id, b.is_reprise, b.metadata, b.block_type, p.name from gsa_tv_program_blocks b left join gsa_tv_programs p on p.id=b.program_id where b.schedule_version_id=\\\$1 order by b.planned_start_offset_s, b.position\", [versionId]);
  console.log('=== TOTAL BLOCKS ===', b.rows.length);
  console.log('=== BLOCKS ===');
  console.log(JSON.stringify(b.rows, null, 2));
  await p.end();
})().catch(e => { console.error(e); process.exit(1); });
"
