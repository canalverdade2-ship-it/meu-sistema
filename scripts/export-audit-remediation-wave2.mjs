import { readFileSync } from 'node:fs';

const files = [
  'src/types.ts',
  'src/components/admin/CuponsLojaModule.tsx',
  'src/components/admin/OrcamentosModule.tsx',
  'src/components/admin/PremiosModule.tsx',
  'src/components/admin/PrestadoresModule.tsx',
  'src/components/admin/ProdutosModule.tsx',
  'src/components/admin/TravelAdminModule.tsx',
  'src/components/admin/demandas/DemandasDetalhesModal.tsx',
  'src/components/admin/ui/AdminWhatsAppButton.tsx',
  'src/components/client/ClientOrcamentos.tsx',
  'src/components/client/financeiro/FaturasList.tsx',
  'src/components/client/ClientDashboard.tsx',
];

const archive = Object.fromEntries(files.map((path) => [path, readFileSync(path, 'utf8')]));
const encoded = Buffer.from(JSON.stringify(archive), 'utf8').toString('base64');
const chunkSize = 6000;
const chunks = [];
for (let index = 0; index < encoded.length; index += chunkSize) {
  chunks.push(encoded.slice(index, index + chunkSize));
}

console.log(`AUDIT_WAVE2_ARCHIVE_BEGIN ${chunks.length}`);
chunks.forEach((chunk, index) => {
  console.log(`AUDIT_WAVE2_ARCHIVE_CHUNK ${index + 1}/${chunks.length} ${chunk}`);
});
console.log('AUDIT_WAVE2_ARCHIVE_END');
