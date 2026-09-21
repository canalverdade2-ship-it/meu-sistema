import fs from 'fs';
import path from 'path';

const srcDir = path.resolve('src');
const vpsTablesRaw = JSON.parse(fs.readFileSync('.agents/teamwork_preview_explorer_db_1/vps_tables.json', 'utf8'));

// Build table -> columns set from DB
const dbTables = new Map();
for (const col of vpsTablesRaw) {
  const tbl = col.table_name.toLowerCase();
  if (!dbTables.has(tbl)) dbTables.set(tbl, new Set());
  dbTables.get(tbl).add(col.column_name.toLowerCase());
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

const files = getAllFiles(srcDir);

const columnDiscrepancies = [];

// Clean column token helper: strip whitespace, parenthesized joins, aliases
function parseSelectTokens(selectString) {
  const tokens = [];
  // Tokenize by comma at top level
  let current = '';
  let depth = 0;
  for (let i = 0; i < selectString.length; i++) {
    const char = selectString[i];
    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (char === ',' && depth === 0) {
      tokens.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) tokens.push(current.trim());

  const columns = [];
  for (let token of tokens) {
    // If it's a join e.g. "cliente:clientes(id, nome)", skip or parse inner
    if (token.includes('(')) {
      continue;
    }
    // If it has alias e.g. "total_items:count", strip alias
    if (token.includes(':')) {
      const parts = token.split(':');
      token = parts[1] || parts[0];
    }
    token = token.trim();
    if (token && token !== '*' && !token.includes('.')) {
      columns.push(token);
    }
  }
  return columns;
}

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(process.cwd(), file);

  // Match supabase.from('table').select('...')
  const selectRegex = /supabase(?:\.from|\s*\.\s*from)\s*\(\s*['"`]([^'"`]+)['"`]\s*\)[\s\S]*?\.select\s*\(\s*['"`]([\s\S]*?)['"`]\s*\)/g;
  let match;
  while ((match = selectRegex.exec(content)) !== null) {
    const tableName = match[1].toLowerCase();
    const selectStr = match[2];

    if (!dbTables.has(tableName)) {
      continue; // Handled in missing tables
    }

    const tableCols = dbTables.get(tableName);
    const cols = parseSelectTokens(selectStr);

    for (const c of cols) {
      const cLow = c.toLowerCase();
      if (!tableCols.has(cLow)) {
        columnDiscrepancies.push({
          file: relPath,
          table: tableName,
          column: c,
          selectClause: selectStr
        });
      }
    }
  }
}

// Deduplicate
const uniqueIssues = [];
const seen = new Set();
for (const item of columnDiscrepancies) {
  const key = `${item.table}::${item.column}`;
  if (!seen.has(key)) {
    seen.add(key);
    uniqueIssues.push({
      table: item.table,
      column: item.column,
      occurrences: columnDiscrepancies.filter(x => x.table === item.table && x.column === item.column)
    });
  }
}

fs.writeFileSync(
  '.agents/teamwork_preview_explorer_db_1/precise_column_issues.json',
  JSON.stringify(uniqueIssues, null, 2),
  'utf8'
);

console.log('Unique missing column issues detected in frontend queries:', uniqueIssues.length);
console.log(JSON.stringify(uniqueIssues, null, 2));
