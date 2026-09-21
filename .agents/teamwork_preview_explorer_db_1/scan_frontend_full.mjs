import fs from 'fs';
import path from 'path';

const srcDir = path.resolve('src');

function getAllFiles(dir, exts = ['.ts', '.tsx', '.js', '.jsx']) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getAllFiles(fullPath, exts));
    } else if (exts.includes(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = getAllFiles(srcDir);

const tablesReferenced = {};
const supabaseRpcs = {};
const adminRpcs = {};

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(process.cwd(), file);

  // Match supabase.from('table').select(...)
  const fromRegex = /supabase(?:\.from|\s*\.\s*from)\s*\(\s*['"`]([^'"`]+)['"`]\s*\)([\s\S]*?)(?=(?:supabase|\n\s*\n|\bconst\b|\blet\b|\bfunction\b|\breturn\b|;\s*$|$))/g;
  let match;
  while ((match = fromRegex.exec(content)) !== null) {
    const table = match[1];
    const chained = match[2] || '';
    if (!tablesReferenced[table]) {
      tablesReferenced[table] = { files: [], selects: [], mutations: [] };
    }
    if (!tablesReferenced[table].files.includes(relPath)) {
      tablesReferenced[table].files.push(relPath);
    }
    // Check for .select('...')
    const selMatches = chained.matchAll(/\.select\s*\(\s*['"`]([^'"`]+)['"`]/g);
    for (const sm of selMatches) {
      if (!tablesReferenced[table].selects.includes(sm[1])) {
        tablesReferenced[table].selects.push(sm[1]);
      }
    }
  }

  // Also standalone supabase.from('table')
  const simpleFrom = /supabase(?:\.from|\s*\.\s*from)\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  while ((match = simpleFrom.exec(content)) !== null) {
    const table = match[1];
    if (!tablesReferenced[table]) {
      tablesReferenced[table] = { files: [], selects: [], mutations: [] };
    }
    if (!tablesReferenced[table].files.includes(relPath)) {
      tablesReferenced[table].files.push(relPath);
    }
  }

  // RPC regex
  const rpcRegex = /supabase(?:\.rpc|\s*\.\s*rpc)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  while ((match = rpcRegex.exec(content)) !== null) {
    const rpc = match[1];
    if (!supabaseRpcs[rpc]) {
      supabaseRpcs[rpc] = [];
    }
    if (!supabaseRpcs[rpc].includes(relPath)) {
      supabaseRpcs[rpc].push(relPath);
    }
  }

  // callAdminRpc regex
  const adminRpcRegex = /callAdminRpc(?:<[^>]+>)?\s*\(\s*['"`]([^'"`]+)['"`]/g;
  while ((match = adminRpcRegex.exec(content)) !== null) {
    const rpc = match[1];
    if (!adminRpcs[rpc]) {
      adminRpcs[rpc] = [];
    }
    if (!adminRpcs[rpc].includes(relPath)) {
      adminRpcs[rpc].push(relPath);
    }
  }
}

const catalog = {
  tablesReferenced,
  supabaseRpcs,
  adminRpcs
};

fs.writeFileSync(
  path.resolve('.agents/teamwork_preview_explorer_db_1/frontend_catalog.json'),
  JSON.stringify(catalog, null, 2),
  'utf8'
);

console.log('Tables count:', Object.keys(tablesReferenced).length);
console.log('Supabase RPC count:', Object.keys(supabaseRpcs).length);
console.log('Admin RPC count:', Object.keys(adminRpcs).length);
