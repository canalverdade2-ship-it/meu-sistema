import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const dir = path.join(root, 'src', 'components', 'admin');
const files = [];
function walk(d){ for(const e of fs.readdirSync(d,{withFileTypes:true})){ const p=path.join(d,e.name); if(e.isDirectory()) walk(p); else if(/\.tsx?$/.test(e.name)) files.push(p); }}
walk(dir);
const hits = [];
for (const file of files) {
  const s = fs.readFileSync(file,'utf8');
  const re = /\.from\(['"`]([^'"`]+)['"`]\)([\s\S]{0,300}?)\.(insert|update|delete|upsert)\(/g;
  for (const m of s.matchAll(re)) hits.push({table:m[1], action:m[3], file:path.relative(root,file)});
}
const by = new Map();
for(const h of hits){ if(!by.has(h.table)) by.set(h.table,new Set()); by.get(h.table).add(h.action); }
for(const [table,actions] of [...by.entries()].sort()) console.log(`${table}|${[...actions].sort().join(',')}`);
console.error(`TABLES=${by.size}|HITS=${hits.length}`);
