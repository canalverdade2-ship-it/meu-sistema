const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const migrationsDir = path.join(rootDir, 'supabase', 'migrations');
const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));

const allFiles = [
  { name: 'master_supabase_schema.sql', path: path.join(rootDir, 'master_supabase_schema.sql') },
  ...migrationFiles.map(f => ({ name: f, path: path.join(migrationsDir, f) }))
];

const allForeignKeys = [];
const allIndexes = [];

for (const f of allFiles) {
  if (!fs.existsSync(f.path)) continue;
  const content = fs.readFileSync(f.path, 'utf8');

  // Find CREATE TABLE bodies
  const ctRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\n\);/gi;
  let ctm;
  while ((ctm = ctRegex.exec(content)) !== null) {
    const table = ctm[1].toLowerCase();
    const body = ctm[2];
    const lines = body.split('\n');
    for (let line of lines) {
      line = line.trim().replace(/,$/, '');
      if (!line || line.startsWith('--')) continue;

      // Inline REFERENCES
      const inlineMatch = line.match(/^([a-zA-Z0-9_]+)\s+[^,]+REFERENCES\s+(?:public\.)?([a-zA-Z0-9_]+)(?:\(([^)]+)\))?/i);
      if (inlineMatch) {
        allForeignKeys.push({
          table: table,
          column: inlineMatch[1].toLowerCase(),
          refTable: inlineMatch[2].toLowerCase(),
          refColumn: inlineMatch[3] ? inlineMatch[3].toLowerCase() : 'id',
          file: f.name
        });
      }

      // Explicit CONSTRAINT ... FOREIGN KEY
      const fkMatch = line.match(/FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:public\.)?([a-zA-Z0-9_]+)(?:\(([^)]+)\))?/i);
      if (fkMatch) {
        const col = fkMatch[1].trim().toLowerCase();
        if (!allForeignKeys.some(x => x.table === table && x.column === col)) {
          allForeignKeys.push({
            table: table,
            column: col,
            refTable: fkMatch[2].toLowerCase(),
            refColumn: fkMatch[3] ? fkMatch[3].toLowerCase() : 'id',
            file: f.name
          });
        }
      }
    }
  }

  // ALTER TABLE ADD CONSTRAINT FOREIGN KEY
  const alterFkRegex = /ALTER\s+TABLE\s+(?:ONLY\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s+ADD\s+CONSTRAINT\s+([a-zA-Z0-9_]+)\s+FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:public\.)?([a-zA-Z0-9_]+)(?:\(([^)]+)\))?/gi;
  let afk;
  while ((afk = alterFkRegex.exec(content)) !== null) {
    const table = afk[1].toLowerCase();
    const col = afk[3].trim().toLowerCase();
    if (!allForeignKeys.some(x => x.table === table && x.column === col)) {
      allForeignKeys.push({
        table: table,
        column: col,
        refTable: afk[4].toLowerCase(),
        refColumn: afk[5] ? afk[5].toLowerCase() : 'id',
        file: f.name
      });
    }
  }

  // Indexes
  const idxRegex = /CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)?\s*ON\s+(?:public\.)?([a-zA-Z0-9_]+)(?:\s+USING\s+([a-zA-Z0-9_]+))?\s*\(([^)]+)\)(?:\s+WHERE\s+([^;]+))?/gi;
  let im;
  while ((im = idxRegex.exec(content)) !== null) {
    const table = im[3].toLowerCase();
    const cols = im[5].trim().toLowerCase();
    allIndexes.push({
      table: table,
      name: im[2] || 'unnamed',
      unique: !!im[1],
      columns: cols,
      columnsList: cols.split(',').map(c => c.trim().split(/\s+/)[0].replace(/[()]/g, '')),
      where: im[6] ? im[6].trim() : null,
      file: f.name
    });
  }
}

console.log('Total foreign keys found:', allForeignKeys.length);
console.log('Total indexes found in migrations:', allIndexes.length);

// Analyze our core tables
const targetTables = [
  'saques',
  'faturas',
  'tickets',
  'ticket_mensagens',
  'pontos_movimentacoes',
  'vouchers',
  'gsa_voucher_resgates',
  'parceiros_resgates',
  'parceiros_resgates_recursos',
  'parceiros_resgates_eventos',
  'ordens_compra',
  'ordens_assinatura',
  'carteira_lancamentos',
  'pagamentos',
  'prestador_saques',
  'prestador_faturas',
  'prestador_demandas',
  'gsa_afiliado_saques',
  'loja_credito_saques',
  'produto_variantes',
  'produtos',
  'clientes'
];

console.log('\n================================================================================');
console.log('UNINDEXED FOREIGN KEYS IN TARGET TABLES:');
console.log('================================================================================');

for (const t of targetTables) {
  const fks = allForeignKeys.filter(x => x.table === t);
  const tblIndexes = allIndexes.filter(x => x.table === t);

  const unindexedFks = [];
  for (const fk of fks) {
    // A foreign key is indexed if an index exists on that table where the first column is the FK column
    const hasIndex = tblIndexes.some(idx => idx.columnsList[0] === fk.column);
    if (!hasIndex) {
      unindexedFks.push(fk);
    }
  }

  if (unindexedFks.length > 0) {
    console.log(`\nTable [${t}]: ${unindexedFks.length} UNINDEXED FKs (out of ${fks.length} total FKs)`);
    for (const u of unindexedFks) {
      console.log(`  ❌ Column '${u.column}' -> REFERENCES ${u.refTable}(${u.refColumn}) [defined in ${u.file}]`);
    }
  } else {
    console.log(`\nTable [${t}]: All ${fks.length} FKs are indexed! ✅`);
  }
}
