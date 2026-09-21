const fs = require('fs');
const path = require('path');

const domainCatalog = JSON.parse(fs.readFileSync(path.join(__dirname, 'detailed_domain_catalog.json'), 'utf8'));

console.log('# DOMAIN SUMMARY TABLE');
for (const [domainName, tables] of Object.entries(domainCatalog)) {
  console.log(`\n### ${domainName} (${tables.length} tabelas)`);
  for (const t of tables) {
    const pks = (t.primaryKeys || t.pks || []).join(', ');
    const fksCount = (t.foreignKeys || t.fks || []).length;
    const rlsStatus = (t.rlsEnabled || t.rls) ? 'ATIVO' : 'DESATIVADO';
    const colCount = t.columnCount || t.colCount || 0;
    console.log(`- **${t.name}**: ${colCount} colunas | PK: [${pks}] | FKs: ${fksCount} | RLS: ${rlsStatus}`);
  }
}
