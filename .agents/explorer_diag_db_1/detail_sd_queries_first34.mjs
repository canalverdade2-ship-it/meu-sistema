import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const raw = JSON.parse(fs.readFileSync(path.join(root, '.agents', 'explorer_diag_db_1', 'query_audit_raw.json'), 'utf8'));

for (let i = 0; i < 34; i++) {
  const q = raw.superDomainQueries[i];
  console.log(`[Query #${i + 1}] ${q.file}:${q.line}`);
  console.log(`  Table: ${q.table}`);
  console.log(`  Select: ${q.select || '(none / mutation)'}`);
  console.log(`  Snippet: ${q.snippet}`);
  console.log('---');
}
