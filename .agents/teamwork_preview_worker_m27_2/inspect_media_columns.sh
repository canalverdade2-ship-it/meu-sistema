docker exec -i gsa-tv-control-plane node -e "
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const q = await p.query(\`
    select column_name, data_type, is_nullable, column_default
    from information_schema.columns
    where table_name = 'gsa_tv_media_items'
    order by ordinal_position
  \`);
  console.log(q.rows.map(r => \`\${r.column_name} (\${r.data_type}, nullable: \${r.is_nullable})\`).join('\n'));
  await p.end();
})().catch(e => { console.error(e); process.exit(1); });
"
