docker exec -i gsa-tv-control-plane node -e "
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const q = await p.query(\`
    select 
      id,
      title,
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
    where title ilike '%fé%'
       or title ilike '%fe%'
       or title ilike '%desenho%'
       or title ilike '%pipoca%'
       or title ilike '%music%'
       or title ilike '%continuidade%'
       or id ilike '%fe%'
       or id ilike '%desenho%'
       or id ilike '%pipoca%'
       or id ilike '%music%'
       or id ilike '%continuidade%'
       or metadata->>'program_slug' in ('gsa-em-fe', 'gsa-desenhos', 'gsa-sessao-pipoca', 'gsa-music', 'continuidade-gsa-tv')
    order by duration_s desc
  \`);
  console.log('Matches found:', q.rows.length);
  q.rows.forEach(r => {
    console.log(JSON.stringify(r, null, 2));
  });
  await p.end();
})().catch(e => { console.error(e); process.exit(1); });
"
