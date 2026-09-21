import fs from 'fs';
import path from 'path';

const vpsTables = JSON.parse(fs.readFileSync('.agents/teamwork_preview_explorer_db_1/vps_tables.json', 'utf8'));
const vpsFuncs = JSON.parse(fs.readFileSync('.agents/teamwork_preview_explorer_db_1/vps_functions.json', 'utf8'));

// Build schema map: table -> Set of lowercase columns
const dbMap = new Map();
for (const col of vpsTables) {
  const tbl = col.table_name.toLowerCase();
  if (!dbMap.has(tbl)) dbMap.set(tbl, new Map());
  dbMap.get(tbl).set(col.column_name.toLowerCase(), col);
}

// Build function map: name -> Array of func objects
const funcMap = new Map();
for (const f of vpsFuncs) {
  const name = f.name.toLowerCase();
  if (!funcMap.has(name)) funcMap.set(name, []);
  funcMap.get(name).push(f);
}

function getAllFiles(dir, exts = ['.ts', '.tsx']) {
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

const files = getAllFiles(path.resolve('src'));

const missingTables = new Set();
const missingColumns = [];
const verifiedTables = new Set();

// Parser for PostgREST select strings
function extractColumnsFromSelect(selectStr) {
  const cols = [];
  // Remove whitespace
  let depth = 0;
  let current = '';
  for (let i = 0; i < selectStr.length; i++) {
    const ch = selectStr[i];
    if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth--;
    } else if (ch === ',' && depth === 0) {
      if (current.trim()) cols.push(current.trim());
      current = '';
      continue;
    }
    if (depth === 0) {
      current += ch;
    }
  }
  if (current.trim()) cols.push(current.trim());

  const resultCols = [];
  for (let c of cols) {
    c = c.trim();
    if (!c || c === '*' || c.includes('(')) continue;
    // Check if alias exists: alias:col
    if (c.includes(':')) {
      const parts = c.split(':');
      c = (parts[1] || parts[0]).trim();
    }
    // Check if cast exists: col::type
    if (c.includes('::')) {
      c = c.split('::')[0].trim();
    }
    // Check if expression or function
    if (c.includes(' ') || c.includes('!')) {
      // e.g. "auto_level:client_levels!nivel_id(*)" - already skipped by '(' check, but check '!'
      if (c.includes('!')) continue;
    }
    // Strip quotes
    c = c.replace(/['"`]/g, '').trim();
    if (c && /^[a-zA-Z0-9_]+$/.test(c)) {
      resultCols.push(c);
    }
  }
  return resultCols;
}

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(process.cwd(), file);

  // Match supabase.from('table')
  const fromRegex = /supabase(?:\.from|\s*\.\s*from)\s*\(\s*['"`]([a-zA-Z0-9_]+)['"`]\s*\)/g;
  let fromMatch;
  while ((fromMatch = fromRegex.exec(content)) !== null) {
    const tbl = fromMatch[1].toLowerCase();
    if (!dbMap.has(tbl)) {
      missingTables.add(tbl + ' (in ' + relPath + ')');
    } else {
      verifiedTables.add(tbl);
    }
  }

  // Match .from('table').select('...')
  const fromSelectRegex = /supabase(?:\.from|\s*\.\s*from)\s*\(\s*['"`]([a-zA-Z0-9_]+)['"`]\s*\)[\s\S]*?\.select\s*\(\s*['"`]([\s\S]*?)['"`]\s*[\),]/g;
  let fsMatch;
  while ((fsMatch = fromSelectRegex.exec(content)) !== null) {
    const tbl = fsMatch[1].toLowerCase();
    const selStr = fsMatch[2];
    if (!dbMap.has(tbl)) continue;

    const tblCols = dbMap.get(tbl);
    const cols = extractColumnsFromSelect(selStr);
    for (const c of cols) {
      const cLow = c.toLowerCase();
      if (!tblCols.has(cLow)) {
        missingColumns.push({
          file: relPath,
          table: tbl,
          column: c,
          selectSnippet: selStr.slice(0, 100)
        });
      }
    }
  }
}

// Group missing columns by table and column
const missingColMap = new Map();
for (const mc of missingColumns) {
  const key = `${mc.table}.${mc.column}`;
  if (!missingColMap.has(key)) {
    missingColMap.set(key, { table: mc.table, column: mc.column, files: new Set() });
  }
  missingColMap.get(key).files.add(mc.file);
}

const distinctMissingCols = [];
for (const [key, val] of missingColMap.entries()) {
  distinctMissingCols.push({
    table: val.table,
    column: val.column,
    files: Array.from(val.files)
  });
}

const summary = {
  verifiedTablesCount: verifiedTables.size,
  missingTables: Array.from(missingTables),
  distinctMissingColumns: distinctMissingCols
};

fs.writeFileSync(
  '.agents/teamwork_preview_explorer_db_1/schema_verification_result.json',
  JSON.stringify(summary, null, 2),
  'utf8'
);

console.log('Verified Tables Count:', verifiedTables.size);
console.log('Missing Tables:', summary.missingTables);
console.log('Distinct Missing Columns:', distinctMissingCols);
