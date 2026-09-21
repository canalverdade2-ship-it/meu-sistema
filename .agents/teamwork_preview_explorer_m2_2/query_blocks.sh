docker exec -i gsa-tv-control-plane node -e "
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const versionId = '896c3e00-05a1-48ad-8d1e-bb12cc6a45ef';
  const q = await p.query(\`
    select 
      b.id as block_id,
      b.program_id,
      p.name as program_name,
      b.planned_start_offset_s,
      b.planned_duration_s,
      b.media_item_id,
      b.is_reprise,
      b.metadata,
      b.block_type
    from gsa_tv_program_blocks b
    left join gsa_tv_programs p on p.id = b.program_id
    where b.schedule_version_id = \$1
    order by b.planned_start_offset_s
  \`, [versionId]);
  console.log(JSON.stringify(q.rows, null, 2));
  await p.end();
})().catch(e => { console.error(e); process.exit(1); });
"
