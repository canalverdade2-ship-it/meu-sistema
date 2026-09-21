docker exec -i gsa-tv-control-plane node -e "
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const q = await p.query(\`
    select id, title, duration_s, drive_path, media_kind, source_type, metadata->>'program_slug' as slug
    from gsa_tv_media_items
    where state = 'ready' and approval_state = 'approved' and rights_ok = true and duration_s >= 1800
    order by duration_s desc
  \`);
  console.log('Total approved >= 1800s:', q.rows.length);
  q.rows.forEach(r => {
    console.log(\`\${r.id} | dur: \${r.duration_s}s (\${(r.duration_s/60).toFixed(1)}m) | kind: \${r.media_kind} | slug: \${r.slug || '-'} | title: \${r.title} | path: \${r.drive_path}\`);
  });
  await p.end();
})().catch(e => { console.error(e); process.exit(1); });
"
