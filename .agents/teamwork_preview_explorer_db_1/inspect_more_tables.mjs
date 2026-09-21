import fs from 'fs';

const vpsTables = JSON.parse(fs.readFileSync('.agents/teamwork_preview_explorer_db_1/vps_tables.json', 'utf8'));

const targetTables = [
  'demanda_comentarios',
  'ordens_fiscais',
  'cupons_ativados',
  'prestador_documentos',
  'prestadores',
  'prestador_promocoes',
  'tickets'
];

for (const t of targetTables) {
  const cols = vpsTables
    .filter(c => c.table_name.toLowerCase() === t.toLowerCase())
    .map(c => c.column_name);
  console.log(`Table ${t}:`, cols);
}
