const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const migrationsDir = path.join(rootDir, 'supabase', 'migrations');
const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));

// All files to scan
const allSqlFiles = [
  { name: 'master_supabase_schema.sql', path: path.join(rootDir, 'master_supabase_schema.sql') },
  ...migrationFiles.map(f => ({ name: f, path: path.join(migrationsDir, f) }))
];

const targetTables = [
  'saques',
  'faturas',
  'tickets',
  'pontos_movimentacoes',
  'vouchers',
  'parceiros_resgates',
  'produtos',
  'produto_variante',
  'carteira_saldo',
  'clientes',
  'ordens_compra',
  'ordens_assinatura',
  'pagamentos',
  'carteira_lancamentos',
  'prestador_saques',
  'prestador_faturas',
  'loja_pedidos',
  'loja_solicitacoes',
  'ticket_mensagens',
  'notificacoes'
];

// Data structures
const tableDefinitions = {}; // table -> { file, sql, columns: [], fks: [] }
const tableAlterations = {}; // table -> [ { file, sql } ]
const existingIndexes = {};  // table -> [ { name, type, columns, file, unique, partial } ]

// Regexes
const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\n\);/gi;
const createIndexRegex = /CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)?\s*ON\s+(?:public\.)?([a-zA-Z0-9_]+)(?:\s+USING\s+([a-zA-Z0-9_]+))?\s*\(([^)]+)\)(?:\s+WHERE\s+([^;]+))?/gi;
const alterTableRegex = /ALTER\s+TABLE\s+(?:ONLY\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s+([^;]+);/gi;

for (const fileObj of allSqlFiles) {
  if (!fs.existsSync(fileObj.path)) continue;
  const content = fs.readFileSync(fileObj.path, 'utf8');

  // Find CREATE TABLE
  let match;
  while ((match = createTableRegex.exec(content)) !== null) {
    const tableName = match[1].toLowerCase();
    const body = match[2];
    if (!tableDefinitions[tableName]) {
      tableDefinitions[tableName] = [];
    }
    tableDefinitions[tableName].push({
      file: fileObj.name,
      body: body.trim()
    });
  }

  // Find CREATE INDEX
  while ((match = createIndexRegex.exec(content)) !== null) {
    const isUnique = !!match[1];
    const indexName = match[2] || 'unnamed';
    const tableName = match[3].toLowerCase();
    const indexType = match[4] || 'btree';
    const columns = match[5].trim();
    const whereClause = match[6] ? match[6].trim() : null;

    if (!existingIndexes[tableName]) {
      existingIndexes[tableName] = [];
    }
    existingIndexes[tableName].push({
      name: indexName,
      table: tableName,
      type: indexType,
      columns: columns,
      unique: isUnique,
      where: whereClause,
      file: fileObj.name
    });
  }

  // Find ALTER TABLE
  while ((match = alterTableRegex.exec(content)) !== null) {
    const tableName = match[1].toLowerCase();
    const clause = match[2].trim();
    if (targetTables.includes(tableName)) {
      if (!tableAlterations[tableName]) {
        tableAlterations[tableName] = [];
      }
      tableAlterations[tableName].push({
        file: fileObj.name,
        clause: clause
      });
    }
  }
}

console.log('=== AUDIT REPORT SUMMARY ===');
console.log('Target tables found in schema/migrations:');

for (const t of targetTables) {
  const defs = tableDefinitions[t] || [];
  const idxs = existingIndexes[t] || [];
  const alters = tableAlterations[t] || [];
  console.log(`\n--------------------------------------------------`);
  console.log(`TABLE: ${t}`);
  console.log(`  Definitions (${defs.length}): ${defs.map(d => d.file).join(', ') || 'NONE'}`);
  console.log(`  Existing Indexes (${idxs.length}):`);
  for (const idx of idxs) {
    console.log(`    - ${idx.name} ON (${idx.columns}) [${idx.type.toUpperCase()}] ${idx.unique ? 'UNIQUE ' : ''}${idx.where ? 'WHERE ' + idx.where : ''} (file: ${idx.file})`);
  }
  if (alters.length > 0) {
    console.log(`  Alterations (${alters.length}):`);
    for (const alt of alters) {
      console.log(`    - [${alt.file}] ${alt.clause.replace(/\n/g, ' ')}`);
    }
  }
}

// Write json output for deep analysis
fs.writeFileSync(path.join(__dirname, 'schema_audit_results.json'), JSON.stringify({
  tableDefinitions,
  existingIndexes,
  tableAlterations
}, null, 2));

console.log('\nSaved full audit data to scratch/schema_audit_results.json');
