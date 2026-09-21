docker exec -i gsa-tv-control-plane node -e "
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const versionId = '896c3e00-05a1-48ad-8d1e-bb12cc6a45ef';
  const b = await p.query(\"select b.id, b.planned_start_offset_s, b.planned_duration_s, b.media_item_id, b.is_reprise, (b.metadata->>'content_mode') as content_mode, b.block_type, p.name from gsa_tv_program_blocks b left join gsa_tv_programs p on p.id=b.program_id where b.schedule_version_id=\\\$1 order by b.planned_start_offset_s, b.position\", [versionId]);
  
  function fmtTime(s) {
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    return \`\${h}:\${m}:\${sec}\`;
  }

  console.log('Index | Start | End | Dur(s) | Block ID | Program | Mode | Media Item ID');
  console.log('---|---|---|---|---|---|---|---');
  b.rows.forEach((r, idx) => {
    const start = fmtTime(r.planned_start_offset_s);
    const end = fmtTime(r.planned_start_offset_s + r.planned_duration_s);
    console.log(\`\${idx + 1} | \${start} | \${end} | \${r.planned_duration_s} | \${r.id} | \${r.name} | \${r.content_mode || '-'} | \${r.media_item_id || 'null'}\`);
  });
  console.log('Total blocks:', b.rows.length);
  await p.end();
})().catch(e => { console.error(e); process.exit(1); });
"
