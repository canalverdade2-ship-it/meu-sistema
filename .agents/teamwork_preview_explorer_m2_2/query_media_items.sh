docker exec -i gsa-tv-control-plane node -e "
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const q = await p.query(\`
    select 
      id,
      channel_id,
      title,
      original_filename,
      duration_s,
      state,
      approval_state,
      rights_ok,
      rights_expires_at,
      drive_path,
      media_kind,
      source_type,
      metadata
    from gsa_tv_media_items
    order by updated_at desc
  \`);
  console.log('Total media items:', q.rows.length);
  q.rows.forEach(r => {
    console.log({
      id: r.id,
      title: r.title,
      duration_s: r.duration_s,
      state: r.state,
      approval_state: r.approval_state,
      rights_ok: r.rights_ok,
      drive_path: r.drive_path,
      media_kind: r.media_kind,
      program_id: r.metadata?.program_id,
      program_slug: r.metadata?.program_slug
    });
  });
  await p.end();
})().catch(e => { console.error(e); process.exit(1); });
"
