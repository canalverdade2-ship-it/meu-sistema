docker exec -i gsa-tv-control-plane node -e "
const { Pool } = require('pg');
const fs = require('fs');
const p = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const versionId = '896c3e00-05a1-48ad-8d1e-bb12cc6a45ef';
  const blocksRes = await p.query(\`
    select b.id as block_id, b.planned_start_offset_s, b.planned_duration_s, b.media_item_id, 
           b.is_reprise, (b.metadata->>'content_mode') as content_mode, b.block_type, 
           p.id as program_id, p.name as program_name
    from gsa_tv_program_blocks b 
    left join gsa_tv_programs p on p.id=b.program_id 
    where b.schedule_version_id=\\\$1 
    order by b.planned_start_offset_s, b.position
  \`, [versionId]);

  const allMedia = await p.query(\`
    select id, title, duration_s, state, approval_state, rights_ok, drive_path, 
           metadata->>'program_slug' as program_slug, 
           metadata->>'program_id' as program_id,
           metadata->>'broadcast_date' as broadcast_date
    from gsa_tv_media_items 
    where channel_id='ch-main'
  \`);

  function fmtTime(s) {
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    return \`\${h}:\${m}:\${sec}\`;
  }

  function slugify(name) {
    if (!name) return '';
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  const result = [];

  for (const b of blocksRes.rows) {
    const pSlug = slugify(b.program_name);
    // find candidates in allMedia
    const candidates = allMedia.rows.filter(m => {
      const matchSlug = m.program_slug === pSlug;
      const matchProgId = m.program_id === b.program_id;
      const titleMatch = m.title && m.title.toLowerCase().includes(b.program_name.toLowerCase());
      return matchSlug || matchProgId || titleMatch;
    });

    result.push({
      block_id: b.block_id,
      program_id: b.program_id,
      program_name: b.program_name,
      slug: pSlug,
      start: fmtTime(b.planned_start_offset_s),
      end: fmtTime(b.planned_start_offset_s + b.planned_duration_s),
      duration_s: b.planned_duration_s,
      content_mode: b.content_mode,
      is_reprise: b.is_reprise,
      linked_media_item_id: b.media_item_id,
      matching_media_count: candidates.length,
      matching_media: candidates.map(c => ({
        id: c.id,
        title: c.title,
        duration_s: c.duration_s,
        state: c.state,
        approval_state: c.approval_state,
        rights_ok: c.rights_ok,
        broadcast_date: c.broadcast_date,
        drive_path: c.drive_path
      }))
    });
  }

  console.log(JSON.stringify(result, null, 2));
  await p.end();
})().catch(e => { console.error(e); process.exit(1); });
"
