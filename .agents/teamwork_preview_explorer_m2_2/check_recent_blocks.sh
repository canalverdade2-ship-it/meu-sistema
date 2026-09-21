docker exec -i gsa-tv-control-plane node -e "
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const r = await p.query(\`
    select 
      v.broadcast_date,
      v.version,
      v.state,
      b.id as block_id,
      p.name as program_name,
      b.planned_start_offset_s,
      b.planned_duration_s,
      b.media_item_id,
      m.title as media_title,
      m.duration_s as media_dur,
      m.drive_path
    from gsa_tv_program_blocks b
    join gsa_tv_schedule_versions v on v.id = b.schedule_version_id
    left join gsa_tv_programs p on p.id = b.program_id
    left join gsa_tv_media_items m on m.id = b.media_item_id
    where (b.metadata->>'content_mode' = 'library' or b.is_reprise = true or p.name in ('GSA Em Fé', 'GSA Desenhos', 'GSA Sessão Pipoca', 'GSA Music', 'Continuidade GSA TV'))
      and v.broadcast_date >= '2026-09-10'
    order by v.broadcast_date desc, b.planned_start_offset_s
  \`);
  r.rows.forEach(row => {
    const d = new Date(row.broadcast_date).toISOString().slice(0,10);
    console.log(\`[\${d} v\${row.version} \${row.state}] \${row.program_name} (\${row.planned_duration_s}s) -> media_id: \${row.media_item_id} | title: \${row.media_title} | dur: \${row.media_dur}s | path: \${row.drive_path}\`);
  });
  await p.end();
})().catch(e => { console.error(e); process.exit(1); });
"
