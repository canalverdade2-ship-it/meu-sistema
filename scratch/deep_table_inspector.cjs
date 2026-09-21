const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const migrationsDir = path.join(rootDir, 'supabase', 'migrations');
const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));

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
  'produto_variantes',
  'produtos',
  'clientes',
  'carteira_lancamentos',
  'pagamentos',
  'ordens_compra',
  'ordens_assinatura',
  'prestador_saques',
  'prestador_faturas',
  'gsa_afiliado_saques',
  'loja_credito_saques',
  'ticket_mensagens',
  'gsa_voucher_resgates',
  'parceiros_resgates_recursos',
  'parceiros_resgates_eventos'
];

const report = {};

for (const t of targetTables) {
  report[t] = {
    tableName: t,
    definedIn: [],
    rawCreateSql: '',
    columns: [],
    foreignKeys: [],
    existingIndexes: [],
    alterations: []
  };
}

// 1. Gather table definitions
for (const fileObj of allSqlFiles) {
  const content = fs.readFileSync(fileObj.path, 'utf8');

  // Indexes
  const idxRegex = /CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)?\s*ON\s+(?:public\.)?([a-zA-Z0-9_]+)(?:\s+USING\s+([a-zA-Z0-9_]+))?\s*\(([^)]+)\)(?:\s+WHERE\s+([^;]+))?/gi;
  let m;
  while ((m = idxRegex.exec(content)) !== null) {
    const isUnique = !!m[1];
    const indexName = m[2] || 'unnamed';
    const tbl = m[3].toLowerCase();
    const type = m[4] || 'btree';
    const cols = m[5].trim();
    const where = m[6] ? m[6].trim() : null;

    if (report[tbl]) {
      // deduplicate
      if (!report[tbl].existingIndexes.some(x => x.name === indexName && x.columns === cols)) {
        report[tbl].existingIndexes.push({
          name: indexName,
          columns: cols,
          type: type.toLowerCase(),
          unique: isUnique,
          where: where,
          file: fileObj.name
        });
      }
    }
  }

  // CREATE TABLE
  // Match CREATE TABLE [IF NOT EXISTS] [public.]<tbl> (...)
  for (const t of targetTables) {
    const tableRegex = new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:public\\.)?${t}\\s*\\(([\\s\\S]*?)\\n\\);`, 'gi');
    let tm;
    while ((tm = tableRegex.exec(content)) !== null) {
      report[t].definedIn.push(fileObj.name);
      if (!report[t].rawCreateSql) {
        report[t].rawCreateSql = tm[0];
        // parse columns from table body
        const body = tm[1];
        const lines = body.split('\n');
        for (let line of lines) {
          line = line.trim().replace(/,$/, '');
          if (!line || line.startsWith('--')) continue;
          if (/^(CONSTRAINT|PRIMARY\s+KEY|FOREIGN\s+KEY|CHECK|UNIQUE)\b/i.test(line)) {
            // constraint line
            if (/FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+([a-zA-Z0-9_]+)(?:\(([^)]+)\))?/i.test(line)) {
              const fkm = line.match(/FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+([a-zA-Z0-9_]+)(?:\(([^)]+)\))?/i);
              report[t].foreignKeys.push({
                column: fkm[1].trim(),
                refTable: fkm[2].trim(),
                refColumn: fkm[3] ? fkm[3].trim() : 'id',
                source: fileObj.name
              });
            }
            continue;
          }

          // Column line: <col_name> <col_type> [constraints...]
          const colMatch = line.match(/^([a-zA-Z0-9_]+)\s+([A-Za-z0-9_]+(?:\([0-9, ]+\))?(?:\[\])?)([\s\S]*)$/);
          if (colMatch) {
            const colName = colMatch[1];
            const colType = colMatch[2];
            const rest = colMatch[3].trim();
            report[t].columns.push({
              name: colName,
              type: colType,
              details: rest
            });

            // check inline references
            const refMatch = rest.match(/REFERENCES\s+(?:public\.)?([a-zA-Z0-9_]+)(?:\(([^)]+)\))?/i);
            if (refMatch) {
              report[t].foreignKeys.push({
                column: colName,
                refTable: refMatch[1],
                refColumn: refMatch[2] || 'id',
                source: fileObj.name
              });
            }
          }
        }
      }
    }
  }

  // Check foreign key additions via ALTER TABLE
  const fkAlterRegex = /ALTER\s+TABLE\s+(?:ONLY\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s+ADD\s+CONSTRAINT\s+([a-zA-Z0-9_]+)\s+FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:public\.)?([a-zA-Z0-9_]+)(?:\(([^)]+)\))?/gi;
  let fkm;
  while ((fkm = fkAlterRegex.exec(content)) !== null) {
    const tbl = fkm[1].toLowerCase();
    if (report[tbl]) {
      const col = fkm[3].trim();
      const refTbl = fkm[4].trim();
      const refCol = fkm[5] ? fkm[5].trim() : 'id';
      if (!report[tbl].foreignKeys.some(x => x.column === col && x.refTable === refTbl)) {
        report[tbl].foreignKeys.push({
          column: col,
          refTable: refTbl,
          refColumn: refCol,
          source: fileObj.name
        });
      }
    }
  }
}

// Print full detailed summary
for (const t of targetTables) {
  const data = report[t];
  console.log(`\n================================================================================`);
  console.log(`TABLE: ${t}`);
  console.log(`Defined in: ${data.definedIn.join(', ') || 'NOT FOUND'}`);
  console.log(`Total Columns: ${data.columns.length}`);
  console.log(`Columns:`);
  for (const c of data.columns) {
    console.log(`  - ${c.name} (${c.type}) ${c.details}`);
  }
  console.log(`Foreign Keys (${data.foreignKeys.length}):`);
  for (const fk of data.foreignKeys) {
    console.log(`  - ${fk.column} -> ${fk.refTable}(${fk.refColumn}) [${fk.source}]`);
  }
  console.log(`Existing Indexes (${data.existingIndexes.length}):`);
  for (const idx of data.existingIndexes) {
    console.log(`  - ${idx.name} ON (${idx.columns}) [${idx.type.toUpperCase()}] ${idx.unique ? 'UNIQUE ' : ''}${idx.where ? 'WHERE ' + idx.where : ''} (file: ${idx.file})`);
  }
}

fs.writeFileSync(path.join(rootDir, 'scratch', 'deep_table_inspector_output.json'), JSON.stringify(report, null, 2));
console.log('\nWrote scratch/deep_table_inspector_output.json');
