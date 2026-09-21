const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('src');
console.log('Total TS/TSX files scanned:', files.length);

const rpcs = new Map();
const tables = new Map();

const rpcRegex = /\b(?:rpc|callAdminRpc|callPublicRpc)\s*\(\s*[']([^']+)[']/g;
const fromRegex = /(?:\.from)\s*\(\s*[']([^']+)[']/g;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = rpcRegex.exec(content)) !== null) {
    const rpcName = match[1];
    if (!rpcs.has(rpcName)) rpcs.set(rpcName, new Set());
    rpcs.get(rpcName).add(file.replace(/\\/g, '/'));
  }
  while ((match = fromRegex.exec(content)) !== null) {
    const tableName = match[1];
    if (!tables.has(tableName)) tables.set(tableName, new Set());
    tables.get(tableName).add(file.replace(/\\/g, '/'));
  }
});

console.log('\n--- UNIQUE RPCS FOUND (' + rpcs.size + ') ---');
for (const [rpc, fileSet] of Array.from(rpcs.entries()).sort((a,b) => a[0].localeCompare(b[0]))) {
  console.log(rpc + ' -> ' + fileSet.size + ' call sites');
}

console.log('\n--- UNIQUE TABLES FOUND (' + tables.size + ') ---');
for (const [tbl, fileSet] of Array.from(tables.entries()).sort((a,b) => a[0].localeCompare(b[0]))) {
  console.log(tbl + ' -> ' + fileSet.size + ' call sites');
}

fs.writeFileSync('.agents/explorer_db_survey_1/frontend_catalog.json', JSON.stringify({
  rpcs: Object.fromEntries(Array.from(rpcs.entries()).map(([k, v]) => [k, Array.from(v)])),
  tables: Object.fromEntries(Array.from(tables.entries()).map(([k, v]) => [k, Array.from(v)]))
}, null, 2));

