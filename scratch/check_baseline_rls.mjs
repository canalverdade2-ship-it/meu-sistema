import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const inv = JSON.parse(fs.readFileSync(path.join(root, 'audit', 'database-inventory.json'), 'utf8'));
const baselineTables = inv.source.tables;

const dir = path.join(root, 'supabase', 'migrations');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql') && !f.endsWith('.b64')).sort();

const rlsTables = new Map();

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');

  // Static ENABLE ROW LEVEL SECURITY
  for (const m of content.matchAll(/ALTER\s+TABLE\s+(?:ONLY\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi)) {
    rlsTables.set(m[1].toLowerCase(), file);
  }

  // Dynamic loops
  if (content.includes('ENABLE ROW LEVEL SECURITY')) {
    const arrayMatches = content.matchAll(/ARRAY\s*\[([\s\S]*?)\]/gi);
    for (const am of arrayMatches) {
      const items = am[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '').toLowerCase());
      for (const item of items) {
        if (/^[a-z0-9_]+$/.test(item)) {
          rlsTables.set(item, file);
        }
      }
    }
    const valuesMatches = content.matchAll(/VALUES\s*([\s\S]*?)\)\s*AS/gi);
    for (const vm of valuesMatches) {
      for (const row of vm[1].matchAll(/\(\s*'([a-z0-9_]+)'/gi)) {
        rlsTables.set(row[1].toLowerCase(), file);
      }
    }
    const unnestMatches = content.matchAll(/unnest\s*\(\s*ARRAY\s*\[([\s\S]*?)\]\s*\)/gi);
    for (const um of unnestMatches) {
      const items = um[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '').toLowerCase());
      for (const item of items) {
        if (/^[a-z0-9_]+$/.test(item)) {
          rlsTables.set(item, file);
        }
      }
    }
  }
}

const missing = [];
for (const t of baselineTables) {
  if (!rlsTables.has(t.toLowerCase())) {
    missing.push(t);
  }
}

console.log('Total baseline tables checked:', baselineTables.length);
console.log('Baseline tables missing RLS:', missing.length);
if (missing.length > 0) {
  console.log('Missing list:', missing);
}
