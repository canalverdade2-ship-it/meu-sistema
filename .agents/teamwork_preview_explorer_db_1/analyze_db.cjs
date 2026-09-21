const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const migrationsDir = path.join(root, 'supabase', 'migrations');
const masterSchemaFile = path.join(root, 'master_supabase_schema.sql');

console.log('Scanning database schema, migrations and RLS policies...');

const tables = new Map();
const functions = new Map();
const triggers = [];
const rlsPolicies = [];
const grantsRevokes = [];

function ensureTable(tbl) {
  const t = tbl.toLowerCase().replace(/^public\./, '');
  if (!tables.has(t)) {
    tables.set(t, {
      name: t,
      columns: new Map(),
      primaryKeys: new Set(),
      foreignKeys: [],
      rlsEnabled: false,
      policies: []
    });
  }
  return tables.get(t);
}

function processSQL(content, filename) {
  // 1. CREATE TABLE
  const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\);/gi;
  let match;
  while ((match = createTableRegex.exec(content)) !== null) {
    const tblName = match[1].toLowerCase();
    const body = match[2];
    const tbl = ensureTable(tblName);

    const lines = body.split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim().replace(/--.*$/, '');
      if (!line) continue;

      const pkMatch = line.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
      if (pkMatch) {
        pkMatch[1].split(',').forEach(c => tbl.primaryKeys.add(c.trim().toLowerCase()));
        continue;
      }
      const fkMatch = line.match(/(?:CONSTRAINT\s+[a-zA-Z0-9_]+\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(([^)]+)\)/i);
      if (fkMatch) {
        tbl.foreignKeys.push({
          column: fkMatch[1].trim().toLowerCase(),
          refTable: fkMatch[2].trim().toLowerCase(),
          refColumn: fkMatch[3].trim().toLowerCase()
        });
        continue;
      }
      if (/^(CONSTRAINT|UNIQUE|CHECK)\b/i.test(line)) continue;

      const colMatch = line.match(/^([a-zA-Z0-9_]+)\s+([^,]+)/);
      if (colMatch) {
        const colName = colMatch[1].toLowerCase();
        const typeAndRest = colMatch[2].trim();
        if (/PRIMARY\s+KEY/i.test(typeAndRest)) {
          tbl.primaryKeys.add(colName);
        }
        const refMatch = typeAndRest.match(/REFERENCES\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(([^)]+)\)/i);
        if (refMatch) {
          tbl.foreignKeys.push({
            column: colName,
            refTable: refMatch[1].trim().toLowerCase(),
            refColumn: refMatch[2].trim().toLowerCase()
          });
        }
        tbl.columns.set(colName, typeAndRest);
      }
    }
  }

  // 2. ALTER TABLE ADD COLUMN
  const addColRegex = /ALTER\s+TABLE\s+(?:ONLY\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)\s+([^;,]+)/gi;
  while ((match = addColRegex.exec(content)) !== null) {
    const tbl = ensureTable(match[1]);
    const colName = match[2].toLowerCase();
    const colDef = match[3].trim();
    tbl.columns.set(colName, colDef);
    const refMatch = colDef.match(/REFERENCES\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(([^)]+)\)/i);
    if (refMatch) {
      tbl.foreignKeys.push({
        column: colName,
        refTable: refMatch[1].trim().toLowerCase(),
        refColumn: refMatch[2].trim().toLowerCase()
      });
    }
  }

  // 3. ALTER TABLE ADD CONSTRAINT FOREIGN KEY
  const addFkRegex = /ALTER\s+TABLE\s+(?:ONLY\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s+ADD\s+(?:CONSTRAINT\s+[a-zA-Z0-9_]+\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(([^)]+)\)/gi;
  while ((match = addFkRegex.exec(content)) !== null) {
    const tbl = ensureTable(match[1]);
    tbl.foreignKeys.push({
      column: match[2].trim().toLowerCase(),
      refTable: match[3].trim().toLowerCase(),
      refColumn: match[4].trim().toLowerCase()
    });
  }

  // 4. ALTER TABLE ENABLE ROW LEVEL SECURITY
  const rlsRegex = /ALTER\s+TABLE\s+(?:ONLY\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
  while ((match = rlsRegex.exec(content)) !== null) {
    const tbl = ensureTable(match[1]);
    tbl.rlsEnabled = true;
  }

  // 5. CREATE POLICY
  const pRegex = /CREATE\s+POLICY\s+("?[^"\r\n;]+"|[a-zA-Z0-9_]+)\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)([\s\S]*?);/gi;
  while ((match = pRegex.exec(content)) !== null) {
    const polName = match[1].replace(/"/g, '').trim();
    const tblName = match[2].toLowerCase();
    const body = match[3];

    let forCmd = 'ALL';
    const forMatch = body.match(/FOR\s+(ALL|SELECT|INSERT|UPDATE|DELETE)/i);
    if (forMatch) forCmd = forMatch[1].toUpperCase();

    let roles = 'public';
    const toMatch = body.match(/TO\s+([^(\n]+?)(?:USING|WITH\s+CHECK|$)/i);
    if (toMatch) roles = toMatch[1].trim();

    const isRestrictive = /AS\s+RESTRICTIVE/i.test(body);

    let usingExpr = '';
    const uMatch = body.match(/USING\s*\(([\s\S]*?)\)(?:\s+WITH\s+CHECK|$)/i);
    if (uMatch) usingExpr = uMatch[1].trim();

    let checkExpr = '';
    const cMatch = body.match(/WITH\s+CHECK\s*\(([\s\S]*?)\)$/i);
    if (cMatch) checkExpr = cMatch[1].trim();

    const polObj = {
      name: polName,
      table: tblName,
      command: forCmd,
      roles: roles,
      restrictive: isRestrictive,
      using: usingExpr,
      check: checkExpr,
      file: filename
    };
    rlsPolicies.push(polObj);
    const tbl = ensureTable(tblName);
    tbl.policies.push(polObj);
  }

  // 6. CREATE OR REPLACE FUNCTION
  const funcRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\)\s*RETURNS\s+([\s\S]*?)\s+AS\s+[\$']+/gi;
  while ((match = funcRegex.exec(content)) !== null) {
    const funcName = match[1].toLowerCase();
    const paramsRaw = match[2].trim();
    const returnType = match[3].trim();

    const afterMatch = content.substring(match.index, match.index + 2000);
    const isSecDef = /SECURITY\s+DEFINER/i.test(afterMatch);

    functions.set(funcName, {
      name: funcName,
      paramsRaw,
      returnType,
      isSecDef,
      file: filename
    });
  }

  // 7. CREATE TRIGGER
  const triggerRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+([a-zA-Z0-9_]+)\s+(BEFORE|AFTER|INSTEAD\s+OF)\s+([a-zA-Z0-9_\sOR]+)\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)([\s\S]*?)(?:EXECUTE\s+(?:FUNCTION|PROCEDURE)\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\([^)]*\)|;)/gi;
  while ((match = triggerRegex.exec(content)) !== null) {
    triggers.push({
      triggerName: match[1],
      timing: match[2],
      events: match[3].trim(),
      table: match[4].toLowerCase(),
      functionName: match[6] || 'unknown',
      file: filename
    });
  }

  // 8. GRANT / REVOKE
  const grRegex = /(GRANT|REVOKE)\s+(?:ALL|EXECUTE(?:\s+ON\s+FUNCTION)?)\s+(?:ON\s+(?:FUNCTION\s+)?(?:public\.)?([a-zA-Z0-9_]+)(?:\([^)]*\))?)\s+(?:TO|FROM)\s+([^;]+);/gi;
  while ((match = grRegex.exec(content)) !== null) {
    grantsRevokes.push({
      action: match[1].toUpperCase(),
      func: match[2].toLowerCase(),
      roles: match[3].trim(),
      file: filename
    });
  }
}

if (fs.existsSync(masterSchemaFile)) {
  processSQL(fs.readFileSync(masterSchemaFile, 'utf8'), 'master_supabase_schema.sql');
}

const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
for (const file of migrationFiles) {
  processSQL(fs.readFileSync(path.join(migrationsDir, file), 'utf8'), file);
}

console.log(`Total Tables: ${tables.size}`);
console.log(`Total Functions: ${functions.size}`);
console.log(`Total Policies: ${rlsPolicies.length}`);

const outputSummary = {
  tableCount: tables.size,
  functionCount: functions.size,
  triggerCount: triggers.length,
  policyCount: rlsPolicies.length,
  tables: Array.from(tables.values()).map(t => ({
    name: t.name,
    columnCount: t.columns.size,
    columns: Array.from(t.columns.keys()),
    primaryKeys: Array.from(t.primaryKeys),
    foreignKeys: t.foreignKeys,
    rlsEnabled: t.rlsEnabled,
    policies: t.policies
  })),
  policies: rlsPolicies,
  functions: Array.from(functions.values()),
  triggers,
  grantsRevokesCount: grantsRevokes.length
};

fs.writeFileSync(
  path.join(__dirname, 'db_analysis_summary.json'),
  JSON.stringify(outputSummary, null, 2),
  'utf8'
);

console.log('Summary updated successfully.');
