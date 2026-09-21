import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const raw = JSON.parse(fs.readFileSync(path.join(root, '.agents', 'explorer_diag_db_1', 'query_audit_raw.json'), 'utf8'));

// Search queries on prestadores table or joining prestadores
for (const q of raw.superDomainQueries) {
  if (q.table === 'prestadores' || (q.select && q.select.includes('prestadores'))) {
    console.log(`${q.file}:${q.line}`);
    console.log(`Table: ${q.table}`);
    console.log(`Select: ${q.select}`);
    console.log('---');
  }
}
