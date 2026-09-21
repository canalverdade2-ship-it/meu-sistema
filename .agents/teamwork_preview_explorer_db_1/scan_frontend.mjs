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

const tablesReferenced = new Map(); // table -> Set of files & columns
const rpcsReferenced = new Map(); // rpc -> Set of files & sample calls
const adminRpcsReferenced = new Map(); // rpc -> Set of files

// Regex patterns
const supabaseFromRegex = /supabase(?:\.from|\s*\.\s*from)\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
const supabaseRpcRegex = /supabase(?:\.rpc|\s*\.\s*rpc)\s*\(\s*['"`]([^'"`]+)['"`]/g;
const callAdminRpcRegex = /callAdminRpc(?:<[^>]+>)?\s*\(\s*['"`]([^'"`]+)['"`]/g;

// Also look for select strings, e.g. .select('...')
const selectRegex = /\.select\s*\(\s*['"`]([^'"`]+)['"`]/g;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(process.cwd(), file);

  // Scan supabase.from
  let match;
  while ((match = supabaseFromRegex.exec(content)) !== null) {
    const table = match[1];
    if (!tablesReferenced.has(table)) {
      tablesReferenced.set(table, { files: new Set(), selects: new Set() });
    }
    tablesReferenced.get(table).files.add(relPath);
  }

  // Scan supabase.rpc
  while ((match = supabaseRpcRegex.exec(content)) !== null) {
    const rpc = match[1];
    if (!rpcsReferenced.has(rpc)) {
      rpcsReferenced.set(rpc, { files: new Set() });
    }
    rpcsReferenced.get(rpc).files.add(relPath);
  }

  // Scan callAdminRpc
  while ((match = callAdminRpcRegex.exec(content)) !== null) {
    const rpc = match[1];
    if (!adminRpcsReferenced.has(rpc)) {
      adminRpcsReferenced.set(rpc, { files: new Set() });
    }
    adminRpcsReferenced.get(rpc).files.add(relPath);
  }
}

const report = {
  tables: {},
  supabaseRpcs: {},
  adminRpcs: {}
};

for (const [table, data] of tablesReferenced.entries()) {
  report.tables[table] = Array.from(data.files);
}

for (const [rpc, data] of rpcsReferenced.entries()) {
  report.supabaseRpcs[rpc] = Array.from(data.files);
}

for (const [rpc, data] of adminRpcsReferenced.entries()) {
  report.adminRpcs[rpc] = Array.from(data.files);
}

console.log(JSON.stringify(report, null, 2));
