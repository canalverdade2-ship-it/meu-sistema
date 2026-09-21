import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const calls = JSON.parse(fs.readFileSync(path.join(root, '.agents', 'explorer_diag_db_1', 'sd_all_supabase_calls.json'), 'utf8'));

for (const d of ['operacoes', 'financeiro']) {
  console.log(`\n========================================`);
  console.log(`  SUPER DOMAIN: ${d.toUpperCase()}`);
  console.log(`========================================`);
  const domainCalls = calls.filter(c => c.file.includes(`super-domains/${d}`));
  console.log(`Total calls: ${domainCalls.length}\n`);
  for (const c of domainCalls) {
    console.log(`File: ${c.file}:${c.line}`);
    console.log(`Table: ${c.table}`);
    console.log(`Snippet: ${c.callSnippet}`);
    console.log('----------------------------------------');
  }
}
