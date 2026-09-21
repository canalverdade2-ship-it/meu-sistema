const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const migrationsDir = path.join(root, 'supabase', 'migrations');
const masterSchemaFile = path.join(root, 'master_supabase_schema.sql');
const functionsDir = path.join(root, 'supabase', 'functions');

console.log('--- SCANNING MIGRATIONS & SCHEMA ---');

const sqlFiles = [];
if (fs.existsSync(masterSchemaFile)) {
  sqlFiles.push(masterSchemaFile);
}

if (fs.existsSync(migrationsDir)) {
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  files.forEach(f => sqlFiles.push(path.join(migrationsDir, f)));
}

console.log(`Found ${sqlFiles.length} SQL files (including master_supabase_schema.sql).`);

const tablesMap = new Map(); // table_name -> { name, columns: Set/Map, fks: [], pks: [], indexes: [], triggers: [], rlsPolicies: [], sourceFiles: Set }
const rpcsMap = new Map(); // rpc_name -> { name, args, returns, securityDefiner, sourceFiles: Set }
const triggersMap = new Map();
const rlsMap = new Map();

// Helper regexes
const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\);/gi;
const createIndexRegex = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)\s*(?:USING\s+[a-zA-Z0-9_]+\s*)?\(([\s\S]*?)\);/gi;
const createTriggerRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+([a-zA-Z0-9_]+)\s+([\s\S]*?)\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)\s+([\s\S]*?);/gi;
const createPolicyRegex = /CREATE\s+POLICY\s+["']?([^"'\n]+)["']?\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)\s*(?:AS\s+(?:PERMISSIVE|RESTRICTIVE)\s*)?(?:FOR\s+([A-Z]+)\s*)?(?:TO\s+([a-zA-Z0-9_,\s]+)\s*)?(?:USING\s*\(([\s\S]*?)\))?(?:\s*WITH\s+CHECK\s*\(([\s\S]*?)\))?;/gi;
const createFunctionRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\)\s*RETURNS\s+([\s\S]*?)(?:LANGUAGE\s+[a-zA-Z0-9_]+|AS\s+\$\$|SECURITY\s+DEFINER|SET\s+search_path)/gi;

sqlFiles.forEach((filePath) => {
  const relPath = path.relative(root, filePath);
  const content = fs.readFileSync(filePath, 'utf8');

  // Tables
  let match;
  const cTableRegex = new RegExp(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\);/gi);
  while ((match = cTableRegex.exec(content)) !== null) {
    const tableName = match[1].toLowerCase();
    const body = match[2];
    if (!tablesMap.has(tableName)) {
      tablesMap.set(tableName, {
        name: tableName,
        columns: new Map(),
        pks: [],
        fks: [],
        triggers: [],
        indexes: [],
        rlsPolicies: [],
        sources: new Set()
      });
    }
    const tbl = tablesMap.get(tableName);
    tbl.sources.add(relPath);

    // Parse columns roughly
    const lines = body.split('\n');
    lines.forEach(line => {
      const trimmed = line.trim().replace(/,$/, '');
      if (!trimmed || trimmed.startsWith('--')) return;
      if (/^(CONSTRAINT|PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK)/i.test(trimmed)) {
        if (/PRIMARY\s+KEY\s*\(([^)]+)\)/i.test(trimmed)) {
          const pkMatch = trimmed.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
          if (pkMatch) tbl.pks.push(pkMatch[1].trim());
        }
        if (/FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+([a-zA-Z0-9_]+)/i.test(trimmed)) {
          const fkMatch = trimmed.match(/FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:public\.)?([a-zA-Z0-9_]+)(?:\(([^)]+)\))?/i);
          if (fkMatch) {
            tbl.fks.push({ col: fkMatch[1].trim(), targetTable: fkMatch[2].trim(), targetCol: fkMatch[3] ? fkMatch[3].trim() : 'id' });
          }
        }
        return;
      }
      const colMatch = trimmed.match(/^([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+(?:\([^)]+\))?)/i);
      if (colMatch) {
        const colName = colMatch[1].toLowerCase();
        const colType = colMatch[2];
        const isPk = /PRIMARY\s+KEY/i.test(trimmed);
        const isFk = /REFERENCES\s+([a-zA-Z0-9_]+)/i.test(trimmed);
        let fkTarget = null;
        if (isFk) {
          const fkm = trimmed.match(/REFERENCES\s+(?:public\.)?([a-zA-Z0-9_]+)(?:\(([^)]+)\))?/i);
          if (fkm) fkTarget = { targetTable: fkm[1], targetCol: fkm[2] || 'id' };
        }
        if (!tbl.columns.has(colName)) {
          tbl.columns.set(colName, { name: colName, type: colType, isPk, fkTarget, raw: trimmed });
        }
        if (isPk && !tbl.pks.includes(colName)) tbl.pks.push(colName);
        if (fkTarget) tbl.fks.push({ col: colName, targetTable: fkTarget.targetTable, targetCol: fkTarget.targetCol });
      }
    });
  }

  // Alter table add column
  const alterTableColRegex = /ALTER\s+TABLE\s+(?:ONLY\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s+ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+(?:\([^)]+\))?)/gi;
  while ((match = alterTableColRegex.exec(content)) !== null) {
    const tableName = match[1].toLowerCase();
    const colName = match[2].toLowerCase();
    const colType = match[3];
    if (tablesMap.has(tableName)) {
      const tbl = tablesMap.get(tableName);
      if (!tbl.columns.has(colName)) {
        tbl.columns.set(colName, { name: colName, type: colType, raw: match[0] });
      }
      tbl.sources.add(relPath);
    }
  }

  // Indexes
  const cIndexRegex = new RegExp(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)/gi);
  while ((match = cIndexRegex.exec(content)) !== null) {
    const idxName = match[1];
    const tableName = match[2].toLowerCase();
    if (tablesMap.has(tableName)) {
      tablesMap.get(tableName).indexes.push(idxName);
    }
  }

  // Triggers
  const cTrigRegex = new RegExp(/CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+([a-zA-Z0-9_]+)[\s\S]*?ON\s+(?:public\.)?([a-zA-Z0-9_]+)/gi);
  while ((match = cTrigRegex.exec(content)) !== null) {
    const trigName = match[1];
    const tableName = match[2].toLowerCase();
    if (tablesMap.has(tableName)) {
      tablesMap.get(tableName).triggers.push(trigName);
    }
    if (!triggersMap.has(trigName)) {
      triggersMap.set(trigName, { name: trigName, table: tableName, source: relPath });
    }
  }

  // RLS Policies
  const cPolRegex = new RegExp(/CREATE\s+POLICY\s+["']?([^"'\n]+)["']?\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)(?:[\s\S]*?(?:FOR\s+([A-Z]+))?[\s\S]*?(?:TO\s+([a-zA-Z0-9_,\s]+))?[\s\S]*?;)/gi);
  while ((match = cPolRegex.exec(content)) !== null) {
    const polName = match[1].trim();
    const tableName = match[2].toLowerCase();
    const cmd = match[3] || 'ALL';
    const roles = match[4] ? match[4].trim() : 'public';
    const fullKey = `${tableName}::${polName}`;
    if (!rlsMap.has(fullKey)) {
      rlsMap.set(fullKey, { policy: polName, table: tableName, command: cmd, roles, source: relPath });
    }
    if (tablesMap.has(tableName)) {
      tablesMap.get(tableName).rlsPolicies.push(polName);
    }
  }

  // Functions / RPCs
  const cFuncRegex = new RegExp(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\)\s*RETURNS\s+([a-zA-Z0-9_]+(?:\s*TABLE\s*\([\s\S]*?\)|\[\])?)/gi);
  while ((match = cFuncRegex.exec(content)) !== null) {
    const funcName = match[1].toLowerCase();
    const args = match[2].replace(/\s+/g, ' ').trim();
    const returns = match[3].replace(/\s+/g, ' ').trim();
    
    // Check if security definer
    const funcSubstr = content.slice(match.index, match.index + 800);
    const isSecurityDefiner = /SECURITY\s+DEFINER/i.test(funcSubstr);

    if (!rpcsMap.has(funcName)) {
      rpcsMap.set(funcName, {
        name: funcName,
        args,
        returns,
        securityDefiner: isSecurityDefiner,
        sources: new Set([relPath])
      });
    } else {
      const existing = rpcsMap.get(funcName);
      existing.sources.add(relPath);
      if (isSecurityDefiner) existing.securityDefiner = true;
    }
  }
});

console.log(`Extracted:`);
console.log(`- Tables: ${tablesMap.size}`);
console.log(`- Functions/RPCs: ${rpcsMap.size}`);
console.log(`- Triggers: ${triggersMap.size}`);
console.log(`- RLS Policies: ${rlsMap.size}`);

// Save summary to JSON
const output = {
  totalTables: tablesMap.size,
  totalRpcs: rpcsMap.size,
  totalTriggers: triggersMap.size,
  totalRlsPolicies: rlsMap.size,
  tables: Array.from(tablesMap.values()).map(t => ({
    name: t.name,
    columnCount: t.columns.size,
    columns: Array.from(t.columns.values()),
    pks: t.pks,
    fks: t.fks,
    indexes: t.indexes,
    triggers: t.triggers,
    rlsPolicies: t.rlsPolicies,
    sources: Array.from(t.sources)
  })),
  rpcs: Array.from(rpcsMap.values()).map(r => ({
    name: r.name,
    args: r.args,
    returns: r.returns,
    securityDefiner: r.securityDefiner,
    sources: Array.from(r.sources)
  })),
  rlsPolicies: Array.from(rlsMap.values())
};

fs.writeFileSync(path.join(__dirname, 'raw_db_catalog.json'), JSON.stringify(output, null, 2), 'utf8');
console.log('Saved raw_db_catalog.json');
