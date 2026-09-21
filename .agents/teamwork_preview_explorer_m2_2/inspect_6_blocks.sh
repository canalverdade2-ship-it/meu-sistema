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
      and (b.metadata->>'content_mode' = 'library' or b.is_reprise = true)
    order by b.planned_start_offset_s
  \`, [versionId]);

  function fmtTime(s) {
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    return \`\${h}:\${m}:\${sec}\`;
  }

  q.rows.forEach((r, idx) => {
    console.log(\`=== Block \${idx + 1} ===\`);
    console.log(\`Block ID: \${r.block_id}\`);
    console.log(\`Program: \${r.program_name} (ID: \${r.program_id})\`);
    console.log(\`Start: \${fmtTime(r.planned_start_offset_s)} (\${r.planned_start_offset_s}s) | Duration: \${r.planned_duration_s}s (\${r.planned_duration_s/60}m)\`);
    console.log(\`Media Item ID: \${r.media_item_id}\`);
    console.log(\`Is Reprise: \${r.is_reprise}\`);
    console.log(\`Content Mode: \${r.metadata?.content_mode}\`);
    console.log(\`Segment Variant: \${r.metadata?.segment_variant}\`);
    console.log(\`Block Type: \${r.block_type}\`);
    console.log('');
  });

  await p.end();
})().catch(e => { console.error(e); process.exit(1); });
"
