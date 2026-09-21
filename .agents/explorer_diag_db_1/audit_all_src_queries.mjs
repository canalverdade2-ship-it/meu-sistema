import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const tables = JSON.parse(fs.readFileSync(path.join(root, '.agents', 'explorer_diag_db_1', 'schema_tables.json'), 'utf8'));

// Also load foreign keys from deep_live_db_health_audit.json if present
const fkMap = new Map(); // table -> Set of related tables/fk names
const auditLivePath = path.join(root, 'scratch', 'deep_live_db_health_audit.json');
if (fs.existsSync(auditLivePath)) {
  try {
    const live = JSON.parse(fs.readFileSync(auditLivePath, 'utf8'));
    // extract foreign key constraints if available
  } catch (e) {}
}

const sourceFiles = [];
function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist'].includes(f.name)) continue;
    const full = path.join(dir, f.name);
    if (f.isDirectory()) walk(full);
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(f.name)) sourceFiles.push(full);
  }
}
walk(path.join(root, 'src'));

const issues = [];

for (const file of sourceFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(root, file).replaceAll('\\', '/');

  // Find all supabase .from('table')
  const fromRegex = /\.from(?:<[^>]+>)?\(\s*['"]([^'"]+)['"]\s*\)([\s\S]*?)(?=(?:\.from\b|\bconst\b|\blet\b|\bvar\b|\basync\b|\bfunction\b|\bawait\s+supabase|\n\s*\n\s*\n|;|$))/g;
  let match;
  while ((match = fromRegex.exec(content)) !== null) {
    const tableName = match[1];
    const chained = match[2].slice(0, 800);
    const line = content.slice(0, match.index).split('\n').length;

    const tLower = tableName.toLowerCase();
    if (!tables[tLower]) {
      issues.push({
        severity: 'HIGH',
        category: 'INVALID_TABLE',
        file: rel,
        line,
        table: tableName,
        detail: `Table '${tableName}' does not exist in schema.`,
      });
      continue;
    }

    const knownCols = new Set(tables[tLower] || []);

    // Check .select(...)
    const selMatch = chained.match(/\.select(?:<[^>]+>)?\(\s*(`[^`]*`|'[^']*'|"[^"]*")/);
    if (selMatch) {
      const rawSelect = selMatch[1].slice(1, -1).trim();
      
      // Parse top-level columns vs joined tables
      let depth = 0;
      let current = '';
      const tokens = [];
      for (const char of rawSelect) {
        if (char === '(') depth++;
        else if (char === ')') depth--;
        if (char === ',' && depth === 0) {
          if (current.trim()) tokens.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      if (current.trim()) tokens.push(current.trim());

      for (const token of tokens) {
        if (!token || token === '*' || token.includes('*')) continue;

        // Check if join: e.g. "clientes(id, nome)" or "orcamentos:orcamento_id(total)" or "cliente:clientes!cliente_id(nome)"
        const joinMatch = token.match(/^([a-zA-Z0-9_]+)(?:\s*:\s*([a-zA-Z0-9_]+))?(?:![a-zA-Z0-9_]+)?\s*\(([\s\S]*)\)$/);
        if (joinMatch) {
          const alias = joinMatch[1];
          const targetTable = (joinMatch[2] || joinMatch[1]).toLowerCase();
          const nestedSelect = joinMatch[3];

          if (!tables[targetTable]) {
            issues.push({
              severity: 'HIGH',
              category: 'INVALID_JOIN_TABLE',
              file: rel,
              line,
              table: tableName,
              joined: targetTable,
              token,
              detail: `Joined relation '${targetTable}' in table '${tableName}' does not exist in schema.`,
            });
          } else if (tables[targetTable].length > 0 && nestedSelect && !nestedSelect.includes('*')) {
            // Check sub-selected columns in joined table
            const subCols = nestedSelect.split(',').map(s => s.trim().split(':')[0].trim().toLowerCase()).filter(Boolean);
            const targetKnown = new Set(tables[targetTable]);
            for (const sc of subCols) {
              if (sc && !targetKnown.has(sc) && !sc.includes('(') && !sc.includes('count')) {
                issues.push({
                  severity: 'MEDIUM',
                  category: 'INVALID_JOIN_COLUMN',
                  file: rel,
                  line,
                  table: tableName,
                  joined: targetTable,
                  column: sc,
                  detail: `Column '${sc}' does not exist in joined table '${targetTable}'.`,
                });
              }
            }
          }
        } else {
          // Direct column
          let col = token.trim();
          if (col.includes(':')) {
            // alias:col or col:alias
            const parts = col.split(':');
            col = parts[parts.length - 1].trim();
          }
          col = col.split('::')[0].trim().toLowerCase();

          if (knownCols.size > 0 && !knownCols.has(col) && !col.includes('count') && col !== 'id') {
            issues.push({
              severity: 'HIGH',
              category: 'INVALID_COLUMN',
              file: rel,
              line,
              table: tableName,
              column: col,
              detail: `Column '${col}' does not exist in table '${tableName}'.`,
            });
          }
        }
      }
    }
  }
}

fs.writeFileSync(
  path.join(root, '.agents', 'explorer_diag_db_1', 'all_codebase_query_issues.json'),
  JSON.stringify(issues, null, 2)
);

console.log(`Audited all codebase queries. Total issues identified: ${issues.length}`);

// Group by file
const grouped = {};
for (const iss of issues) {
  if (!grouped[iss.file]) grouped[iss.file] = [];
  grouped[iss.file].push(iss);
}

for (const [f, list] of Object.entries(grouped)) {
  console.log(`\n${f} (${list.length} issues):`);
  for (const item of list) {
    console.log(`  L${item.line} [${item.category}] on '${item.table}': ${item.detail}`);
  }
}
