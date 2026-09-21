import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dir = path.join(root, 'supabase', 'migrations');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql') && !f.endsWith('.b64')).sort();

const allTables = new Map(); // name -> createdIn
const rlsTables = new Map(); // name -> enabledIn
const droppedTables = new Set();

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');

  // Static CREATE TABLE
  for (const m of content.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)/gi)) {
    const t = m[1].toLowerCase();
    if (!allTables.has(t)) allTables.set(t, file);
  }

  // DROP TABLE
  for (const m of content.matchAll(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)/gi)) {
    droppedTables.add(m[1].toLowerCase());
  }

  // Static ENABLE ROW LEVEL SECURITY
  for (const m of content.matchAll(/ALTER\s+TABLE\s+(?:ONLY\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi)) {
    rlsTables.set(m[1].toLowerCase(), file);
  }

  // Dynamic loops
  if (content.includes('ENABLE ROW LEVEL SECURITY')) {
    // Array literals: ARRAY['a', 'b', ...]
    const arrayMatches = content.matchAll(/ARRAY\s*\[([\s\S]*?)\]/gi);
    for (const am of arrayMatches) {
      const items = am[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '').toLowerCase());
      for (const item of items) {
        if (/^[a-z0-9_]+$/.test(item)) {
          rlsTables.set(item, file);
        }
      }
    }
    // VALUES (('a', ...), ('b', ...))
    const valuesMatches = content.matchAll(/VALUES\s*([\s\S]*?)\)\s*AS/gi);
    for (const vm of valuesMatches) {
      for (const row of vm[1].matchAll(/\(\s*'([a-z0-9_]+)'/gi)) {
        rlsTables.set(row[1].toLowerCase(), file);
      }
    }
    // unnest(ARRAY[...])
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
for (const [t, createdIn] of allTables.entries()) {
  if (droppedTables.has(t)) continue;
  if (!rlsTables.has(t)) {
    missing.push({ table: t, createdIn });
  }
}

console.log('Total tables created:', allTables.size);
console.log('Tables dropped:', droppedTables.size);
console.log('Tables with RLS enabled:', rlsTables.size);
console.log('Tables missing RLS count:', missing.length);

missing.sort((a, b) => a.table.localeCompare(b.table));
console.log(JSON.stringify(missing, null, 2));
