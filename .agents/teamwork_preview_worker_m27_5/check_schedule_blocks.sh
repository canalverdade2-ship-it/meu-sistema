#!/usr/bin/env bash
docker exec -i gsa-tv-control-plane node -e '
const {Pool} = require("pg");
const p = new Pool({connectionString: process.env.DATABASE_URL});
(async () => {
  const r = await p.query(`
    select b.id, b.planned_start_offset_s, b.planned_duration_s, b.media_item_id, p.name, m.title, m.duration_s, m.state, m.approval_state
    from gsa_tv_program_blocks b
    left join gsa_tv_programs p on p.id=b.program_id
    left join gsa_tv_media_items m on m.id=b.media_item_id
    where b.schedule_version_id=(
      select id from gsa_tv_schedule_versions where channel_id=\x27ch-main\x27 and broadcast_date=\x272026-09-15\x27 and state=\x27published\x27 order by version desc limit 1
    )
    order by b.planned_start_offset_s
  `);
  console.log("SCHEDULE BLOCKS (Total " + r.rows.length + "):");
  for (const b of r.rows) {
    console.log(`${b.planned_start_offset_s}s - ${b.name} | media_item_id: ${b.media_item_id ? b.media_item_id.slice(0, 20) + "..." : "NULL"} | duration: ${b.duration_s || b.planned_duration_s}s`);
  }
  await p.end();
})().catch(console.error);
'
