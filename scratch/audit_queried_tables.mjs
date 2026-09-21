import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcDir = path.join(root, 'src');

const queriedTables = new Map(); // table -> Set<files>

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const matches = content.matchAll(/\.from\s*(?:<[^>]+>)?\s*\(\s*['"]([a-zA-Z0-9_]+)['"]\s*\)/gi);
      for (const m of matches) {
        const tbl = m[1].toLowerCase();
        if (!queriedTables.has(tbl)) queriedTables.set(tbl, new Set());
        const rel = path.relative(root, fullPath).replaceAll('\\', '/');
        queriedTables.get(tbl).add(rel);
      }
    }
  }
}

scanDir(srcDir);

const fullRep = JSON.parse(fs.readFileSync(path.join(root, 'scratch', 'audit_full_database_report.json'), 'utf8'));
const tableMap = new Map();
for (const t of fullRep.allTables) {
  tableMap.set(t.name, t);
}

const statusList = [];
for (const [tbl, fileSet] of queriedTables.entries()) {
  const info = tableMap.get(tbl);
  statusList.push({
    table: tbl,
    rls: info ? info.rls : 'VIEW_OR_UNTRACKED',
    policiesCount: info ? info.policiesCount : 0,
    queriedInFilesCount: fileSet.size
  });
}

statusList.sort((a, b) => a.table.localeCompare(b.table));
fs.writeFileSync(path.join(root, 'scratch', 'queried_tables_status.json'), JSON.stringify(statusList, null, 2));

const zeroPols = statusList.filter(s => s.policiesCount === 0);
console.log(`Total queried tables: ${statusList.length}`);
console.log(`Queried tables with 0 policies: ${zeroPols.length}`);
zeroPols.forEach(z => {
  console.log(`- ${z.table} (queried in ${z.queriedInFilesCount} files, RLS: ${z.rls})`);
});
