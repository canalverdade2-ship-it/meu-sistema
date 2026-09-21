docker exec -i gsa-tv-control-plane node -e "
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const versionId = '896c3e00-05a1-48ad-8d1e-bb12cc6a45ef';
  const q = await p.query(\`
    select b.id, p.name, b.planned_start_offset_s, b.planned_duration_s, b.media_item_id, m.title, m.approval_state, m.rights_ok
    from gsa_tv_program_blocks b
    left join gsa_tv_programs p on p.id = b.program_id
    left join gsa_tv_media_items m on m.id = b.media_item_id
    where b.schedule_version_id = \$1
      and (b.metadata->>'content_mode' = 'library' or b.is_reprise = true)
    order by b.planned_start_offset_s
  \`, [versionId]);
  console.table(q.rows);
  await p.end();
})().catch(e => { console.error(e); process.exit(1); });
"
