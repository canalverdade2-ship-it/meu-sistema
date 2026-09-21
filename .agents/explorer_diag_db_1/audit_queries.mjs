import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

// 1. Read all SQL files and extract tables + columns
function parseSqlFiles() {
  const tables = new Map(); // tableName -> Set of column names

  function addColumn(table, col) {
    const cleanTable = table.toLowerCase().trim();
    const cleanCol = col.toLowerCase().trim();
    if (!tables.has(cleanTable)) {
      tables.set(cleanTable, new Set());
    }
    tables.get(cleanTable).add(cleanCol);
  }

  const sqlFiles = [];
  function walkSql(dir) {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.git', 'dist'].includes(f.name)) continue;
      const full = path.join(dir, f.name);
      if (f.isDirectory()) walkSql(full);
      else if (f.name.endsWith('.sql')) sqlFiles.push(full);
    }
  }

  walkSql(path.join(root, 'supabase', 'migrations'));
  walkSql(path.join(root, 'infrastructure'));
  if (fs.existsSync(path.join(root, 'master_supabase_schema.sql'))) {
    sqlFiles.push(path.join(root, 'master_supabase_schema.sql'));
  }
  if (fs.existsSync(path.join(root, 'evolution_db.sql'))) {
    sqlFiles.push(path.join(root, 'evolution_db.sql'));
  }

  for (const sqlFile of sqlFiles) {
    const content = fs.readFileSync(sqlFile, 'utf8');

    // Regex for CREATE TABLE [IF NOT EXISTS] table_name ( ... );
    const createTableRegex = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\);/gi;
    let match;
    while ((match = createTableRegex.exec(content)) !== null) {
      const tableName = match[1].toLowerCase();
      const body = match[2];
      
      // Parse column lines
      const lines = body.split('\n');
      for (const rawLine of lines) {
        const line = rawLine.trim().replace(/--.*$/, '').replace(/,$/, '').trim();
        if (!line) continue;
        if (/^(CONSTRAINT|PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK)\b/i.test(line)) continue;
        const colMatch = line.match(/^([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+(?:\([^)]+\))?)/);
        if (colMatch) {
          const colName = colMatch[1].toLowerCase();
          addColumn(tableName, colName);
        }
      }
    }

    // Regex for ALTER TABLE table_name ADD COLUMN [IF NOT EXISTS] col_name col_type;
    const alterTableRegex = /ALTER\s+TABLE(?:\s+ONLY)?\s+(?:public\.)?([a-zA-Z0-9_]+)\s+ADD\s+COLUMN(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-zA-Z0-9_]+)/gi;
    while ((match = alterTableRegex.exec(content)) !== null) {
      const tableName = match[1].toLowerCase();
      const colName = match[2].toLowerCase();
      addColumn(tableName, colName);
    }
  }

  // Also include tables from database-inventory.json
  const invPath = path.join(root, 'audit', 'database-inventory.json');
  let inventoryTables = [];
  if (fs.existsSync(invPath)) {
    try {
      const inv = JSON.parse(fs.readFileSync(invPath, 'utf8'));
      inventoryTables = inv.source?.tables || [];
      for (const t of inventoryTables) {
        if (!tables.has(t.toLowerCase())) {
          tables.set(t.toLowerCase(), new Set());
        }
      }
    } catch (e) {}
  }

  return { tables, sqlFilesCount: sqlFiles.length };
}

// 2. Scan source files for supabase queries
function scanSourceFiles() {
  const sourceFiles = [];
  function walkTs(dir) {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.git', 'dist'].includes(f.name)) continue;
      const full = path.join(dir, f.name);
      if (f.isDirectory()) walkTs(full);
      else if (/\.(ts|tsx|js|mjs|cjs)$/.test(f.name)) sourceFiles.push(full);
    }
  }

  walkTs(path.join(root, 'src'));

  const queries = [];

  for (const filePath of sourceFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relPath = path.relative(root, filePath).replaceAll('\\', '/');

    // Look for .from('tableName')
    // We want to capture the table name, method (select, insert, update, delete), and arguments
    const fromRegex = /\.from(?:<[^>]+>)?\(\s*['"]([^'"]+)['"]\s*\)([\s\S]*?)(?=(?:\.from|\bconst\b|\blet\b|\bvar\b|\basync\b|\bfunction\b|\bawait\s+supabase|\n\s*\n\s*\n|;|$))/g;
    
    let match;
    while ((match = fromRegex.exec(content)) !== null) {
      const tableName = match[1];
      const chainedCalls = match[2].slice(0, 500); // lookahead in chain
      
      const lineIndex = content.slice(0, match.index).split('\n').length;

      // Extract .select(...)
      const selectMatch = chainedCalls.match(/\.select(?:<[^>]+>)?\(\s*(`[^`]*`|'[^']*'|"[^"]*")/);
      const selectArg = selectMatch ? selectMatch[1].slice(1, -1) : null;

      // Extract .insert(...)
      const isInsert = chainedCalls.includes('.insert(');
      // Extract .update(...)
      const isUpdate = chainedCalls.includes('.update(');

      queries.push({
        file: relPath,
        line: lineIndex,
        table: tableName,
        select: selectArg,
        isInsert,
        isUpdate,
        snippet: chainedCalls.trim().split('\n')[0],
      });
    }
  }

  return queries;
}

const { tables, sqlFilesCount } = parseSqlFiles();
const queries = scanSourceFiles();

console.log(`Parsed ${tables.size} tables from ${sqlFilesCount} SQL files.`);
console.log(`Found ${queries.length} supabase .from() queries across src/.`);

// Output table summary
const tableNames = [...tables.keys()].sort();
fs.writeFileSync(
  path.join(root, '.agents', 'explorer_diag_db_1', 'schema_tables.json'),
  JSON.stringify(Object.fromEntries([...tables.entries()].map(([t, cols]) => [t, [...cols].sort()])), null, 2)
);

// Analyze queries
const issues = [];
const superDomainQueries = [];

for (const q of queries) {
  const isSuperDomain = q.file.includes('super-domains');
  if (isSuperDomain) superDomainQueries.push(q);

  const tLower = q.table.toLowerCase();
  if (!tables.has(tLower)) {
    issues.push({
      type: 'UNKNOWN_TABLE',
      file: q.file,
      line: q.line,
      table: q.table,
      detail: `Table '${q.table}' not found in any migration or master schema.`,
    });
    continue;
  }

  const knownCols = tables.get(tLower);
  if (knownCols.size > 0 && q.select) {
    // Parse select columns
    // Handles columns like 'id, nome, valor, orcamentos(total, cliente_id), clientes:cliente_id(nome)'
    const rawCols = q.select;
    if (rawCols !== '*' && !rawCols.includes('*')) {
      // Split top-level commas (outside parentheses)
      const topLevelCols = [];
      let depth = 0;
      let current = '';
      for (const char of rawCols) {
        if (char === '(') depth++;
        else if (char === ')') depth--;
        if (char === ',' && depth === 0) {
          topLevelCols.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      if (current.trim()) topLevelCols.push(current.trim());

      for (const colDef of topLevelCols) {
        if (!colDef) continue;
        // Check if it's a join: e.g. "orcamentos(total)" or "cliente:clientes(nome)" or "orcamentos!inner(id)"
        const joinMatch = colDef.match(/^([a-zA-Z0-9_]+)(?:\s*:\s*([a-zA-Z0-9_]+))?(?:![a-zA-Z0-9_]+)?\s*\((.*)\)$/);
        if (joinMatch) {
          const joinedTable = (joinMatch[2] || joinMatch[1]).toLowerCase();
          const nestedCols = joinMatch[3];
          if (!tables.has(joinedTable)) {
            issues.push({
              type: 'UNKNOWN_JOINED_TABLE',
              file: q.file,
              line: q.line,
              table: q.table,
              detail: `Joined relation/table '${joinedTable}' (in '${colDef}') not found in schema.`,
            });
          }
        } else {
          // Plain column
          // Handle aliases: "col_name:alias" or "alias:col_name"
          let colName = colDef.trim();
          if (colName.includes(':')) {
            const parts = colName.split(':');
            colName = parts[parts.length - 1].trim(); // Supabase syntax is alias:column_name or column_name:alias
          }
          // Remove any modifier like ::text
          colName = colName.split('::')[0].trim().toLowerCase();

          if (!knownCols.has(colName) && knownCols.size > 0 && !colName.includes('count')) {
            issues.push({
              type: 'UNKNOWN_COLUMN',
              file: q.file,
              line: q.line,
              table: q.table,
              column: colName,
              detail: `Column '${colName}' not found in table '${q.table}'. Known columns: ${[...knownCols].join(', ')}`,
            });
          }
        }
      }
    }
  }
}

fs.writeFileSync(
  path.join(root, '.agents', 'explorer_diag_db_1', 'query_audit_raw.json'),
  JSON.stringify({ issues, superDomainQueries, totalQueries: queries.length }, null, 2)
);

console.log(`Audit complete: ${issues.length} potential issues found.`);
