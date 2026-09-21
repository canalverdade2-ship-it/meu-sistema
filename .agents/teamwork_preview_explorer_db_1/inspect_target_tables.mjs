import fs from 'fs';

const vpsTables = JSON.parse(fs.readFileSync('.agents/teamwork_preview_explorer_db_1/vps_tables.json', 'utf8'));

const targetTables = [
  'demanda_comentarios',
  'ordens_fiscais',
  'cupons_ativados',
  'prestador_documentos',
  'prestadores',
  'prestador_promocoes',
  'tickets',
  'parceiros',
  'parceiros_resgates',
  'produtos',
  'cliente_promocoes',
  'viagens_transacoes'
];

const result = {};
for (const t of targetTables) {
  result[t] = vpsTables
    .filter(c => c.table_name.toLowerCase() === t.toLowerCase())
    .map(c => ({
      column: c.column_name,
      type: c.data_type,
      nullable: c.is_nullable,
      default: c.column_default
    }));
}

console.log(JSON.stringify(result, null, 2));
