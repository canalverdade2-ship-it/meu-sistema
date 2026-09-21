import { runSshScript } from '../../scratch/ssh2-run.mjs';

async function main() {
  const script = `
echo "=== 1. SCHEDULE BLOCKS ==="
sudo docker exec -i gsa-tv-control-plane node -e '
const { Pool } = require("pg");
const p = new Pool({ connectionString: process.env.DATABASE_URL });
p.query("select b.id, b.planned_start_offset_s, b.planned_duration_s, b.media_item_id, b.is_reprise, b.metadata, p.name from gsa_tv_program_blocks b left join gsa_tv_programs p on p.id=b.program_id where b.schedule_version_id=$1 order by b.planned_start_offset_s, b.position", ["896c3e00-05a1-48ad-8d1e-bb12cc6a45ef"]).then(r => {
  console.log("Total blocks:", r.rows.length);
  console.table(r.rows.map(row => ({
    time: Math.floor(row.planned_start_offset_s/3600).toString().padStart(2,"0") + ":" + Math.floor((row.planned_start_offset_s%3600)/60).toString().padStart(2,"0"),
    name: row.name,
    dur_min: row.planned_duration_s/60,
    media: row.media_item_id ? "LINKED" : "NULL",
    reprise: row.is_reprise,
    mode: row.metadata?.content_mode || "N/A"
  })));
  p.end();
}).catch(e => { console.error("DB error:", e.message); p.end(); });
'

echo "=== 2. CHECK ROTEIROS 2026-09-15 ==="
ls -la /home/opc/gsa-ai/work/roteiros-2026-09-15/ 2>/dev/null || echo "No dir"
head -n 20 /home/opc/gsa-ai/work/roteiros-2026-09-15/production-sources.json 2>/dev/null || echo "No json"

echo "=== 3. CHECK GSA AGRO OUTPUT FILES ==="
ls -la /opt/gsa-tv/cache/media/1/program-masters/*gsa-agro*2026-09-15* 2>/dev/null || echo "Not yet output"
ls -la /opt/gsa-tv/cache/media/1/audio/programs/gsa-agro/ 2>/dev/null || echo "No audio dir"
`;

  try {
    const res = await runSshScript(script);
    console.log(res.stdout);
    if (res.stderr) console.error("STDERR:", res.stderr);
  } catch (err) {
    console.error("ERROR:", err);
  }
}

main();
