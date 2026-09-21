const fs = require('fs');
const path = require('path');

const origReq = fs.readFileSync('ORIGINAL_REQUEST.md', 'utf8');
const sqlReqMatch = origReq.match(/Tables to include: ([\s\S]*?)\n\n---/);
if (!sqlReqMatch) {
  console.error('Could not find table list in ORIGINAL_REQUEST.md');
  process.exit(1);
}

const reqTables = sqlReqMatch[1]
  .replace(/`/g, '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)
  .sort();

const sqlContent = fs.readFileSync('supabase/migrations/20260826140000_enable_realtime_full_replica_identity_105_tables.sql', 'utf8');
const arrayMatch = sqlContent.match(/v_tables text\[\] := ARRAY\[([\s\S]*?)\];/);
if (!arrayMatch) {
  console.error('Could not find ARRAY in SQL file');
  process.exit(1);
}

const sqlTables = arrayMatch[1]
  .split(',')
  .map(s => s.replace(/['\s]/g, ''))
  .filter(Boolean)
  .sort();

console.log('Required tables count:', reqTables.length);
console.log('SQL tables count:', sqlTables.length);

const missingInSql = reqTables.filter(t => !sqlTables.includes(t));
const extraInSql = sqlTables.filter(t => !reqTables.includes(t));

console.log('Missing in SQL:', missingInSql);
console.log('Extra in SQL:', extraInSql);

const duplicatesInSql = sqlTables.filter((t, i) => sqlTables.indexOf(t) !== i);
console.log('Duplicates in SQL:', duplicatesInSql);

const uniqueSql = new Set(sqlTables);
console.log('Unique SQL tables count:', uniqueSql.size);
