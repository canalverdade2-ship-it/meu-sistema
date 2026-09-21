docker exec -i gsa-tv-control-plane node -e "
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const versionId = '896c3e00-05a1-48ad-8d1e-bb12cc6a45ef';
  const q = await p.query(\`
    select id, planned_start_offset_s, planned_duration_s, (planned_start_offset_s + planned_duration_s) as end_offset, media_item_id
    from gsa_tv_program_blocks
    where schedule_version_id = \$1
    order by planned_start_offset_s
  \`, [versionId]);
  console.log(q.rows);
  await p.end();
})().catch(e => { console.error(e); process.exit(1); });
"
