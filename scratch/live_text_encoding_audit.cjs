const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const root = process.cwd();
const outputJson = path.join(root, 'scratch', 'live_text_encoding_audit.json');
const outputMd = path.join(root, 'scratch', 'live_text_encoding_audit.md');

function quoteIdent(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function markdownTable(rows) {
  if (!rows.length) return '_Nenhuma sequencia suspeita encontrada._';
  return [
    '| Tabela | Coluna | Tipo | Linhas suspeitas |',
    '| --- | --- | --- | ---: |',
    ...rows.map((row) => `| ${row.table_name} | ${row.column_name} | ${row.data_type} | ${row.suspicious_rows} |`),
  ].join('\n');
}

async function main() {
  if (!process.env.SUPABASE_DB_URL) {
    throw new Error('SUPABASE_DB_URL is required. Run through scratch/run_with_db_pooler.cjs.');
  }

  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
    statement_timeout: 30000,
  });

  await client.connect();
  try {
    const columns = await client.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND data_type IN ('text', 'character varying', 'character', 'json', 'jsonb')
      ORDER BY table_name, ordinal_position
    `);

    // Common UTF-8 bytes decoded as Windows-1252/Latin-1, plus replacement chars.
    const patterns = [
      `${String.fromCodePoint(0x00c3)}[${String.fromCodePoint(0x0080)}-${String.fromCodePoint(0x00bf)}]`,
      `${String.fromCodePoint(0x00c2)}[${String.fromCodePoint(0x0080)}-${String.fromCodePoint(0x00bf)}]`,
      `${String.fromCodePoint(0x00e2)}[${String.fromCodePoint(0x0080)}-${String.fromCodePoint(0x00bf)}]`,
      String.fromCodePoint(0xfffd),
    ];
    const regex = patterns.join('|');
    const findings = [];
    const errors = [];

    const columnsByTable = new Map();
    for (const column of columns.rows) {
      const tableColumns = columnsByTable.get(column.table_name) || [];
      tableColumns.push(column);
      columnsByTable.set(column.table_name, tableColumns);
    }

    for (const [tableName, tableColumns] of columnsByTable) {
      const table = quoteIdent(tableName);
      const projections = tableColumns.map((column, index) =>
        `count(*) FILTER (WHERE ${quoteIdent(column.column_name)}::text ~ $1)::int AS c${index}`,
      );
      try {
        const result = await client.query(`SELECT ${projections.join(', ')} FROM public.${table}`, [regex]);
        for (const [index, column] of tableColumns.entries()) {
          const suspiciousRows = result.rows[0]?.[`c${index}`] || 0;
          if (suspiciousRows > 0) {
            findings.push({ ...column, suspicious_rows: suspiciousRows });
          }
        }
      } catch (error) {
        errors.push({ table_name: tableName, error: error.message });
      }
    }

    const result = {
      generated_at: new Date().toISOString(),
      columns_scanned: columns.rowCount,
      affected_columns: findings.length,
      affected_rows_sum: findings.reduce((sum, item) => sum + item.suspicious_rows, 0),
      findings,
      errors,
    };
    fs.writeFileSync(outputJson, JSON.stringify(result, null, 2));
    fs.writeFileSync(outputMd, [
      '# Auditoria de codificacao textual no banco real',
      '',
      `- Gerado em: ${result.generated_at}`,
      `- Colunas verificadas: ${result.columns_scanned}`,
      `- Colunas afetadas: ${result.affected_columns}`,
      `- Soma de linhas suspeitas por coluna: ${result.affected_rows_sum}`,
      `- Erros de leitura: ${result.errors.length}`,
      '',
      markdownTable(findings),
      '',
      '> A auditoria registra apenas contagens. Nenhum valor textual ou dado pessoal e exportado.',
      '',
    ].join('\n'));

    console.log(JSON.stringify({
      columns_scanned: result.columns_scanned,
      affected_columns: result.affected_columns,
      affected_rows_sum: result.affected_rows_sum,
      errors: result.errors.length,
      output: path.relative(root, outputMd),
    }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
