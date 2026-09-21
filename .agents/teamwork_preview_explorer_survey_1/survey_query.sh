docker exec -i gsa-tv-control-plane node -e "
const {Pool} = require('pg');
const p = new Pool({connectionString: process.env.DATABASE_URL});
p.query(\"select b.id, b.planned_start_offset_s, b.planned_duration_s, b.media_item_id, b.is_reprise, p.name from gsa_tv_program_blocks b left join gsa_tv_programs p on p.id=b.program_id where b.schedule_version_id='896c3e00-05a1-48ad-8d1e-bb12cc6a45ef' order by b.planned_start_offset_s, b.position\").then(r => {
  console.log('Total blocks:', r.rows.length);
  r.rows.forEach(x => {
    const hh = String(Math.floor(x.planned_start_offset_s / 3600)).padStart(2, '0');
    const mm = String(Math.floor((x.planned_start_offset_s % 3600) / 60)).padStart(2, '0');
    console.log(\`\${hh}:\${mm} - \${x.name || 'UNKNOWN'} (\${x.planned_duration_s}s) [media: \${x.media_item_id || 'NONE'}, reprise: \${x.is_reprise}]\`);
  });
  p.end();
}).catch(err => { console.error(err); p.end(); });
"
