import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const wizardPath = path.join(root, 'src/components/client/marketplace/classifieds/CreateListingWizard.tsx');
const storagePath = path.join(root, 'src/lib/classifiedStorage.ts');
const migrationPath = path.join(root, 'supabase/migrations/20260721183000_classifieds_media_storage_production.sql');

for (const filePath of [wizardPath, storagePath, migrationPath]) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo obrigatório dos Classificados ausente: ${path.relative(root, filePath)}`);
  }
}

const wizard = fs.readFileSync(wizardPath, 'utf8');
const storage = fs.readFileSync(storagePath, 'utf8');
const migration = fs.readFileSync(migrationPath, 'utf8');

const forbiddenWizardPatterns = [
  /Simular Upload/i,
  /Mocked/i,
  /para demonstração/i,
  /prompt\s*\(/,
  /Cole a URL de uma imagem/i,
];

for (const pattern of forbiddenWizardPatterns) {
  if (pattern.test(wizard)) {
    throw new Error(`Fluxo de demonstração voltou ao cadastro de anúncio: ${pattern}`);
  }
}

const requiredWizardContracts = [
  "type=\"file\"",
  'accept="image/jpeg,image/png,image/webp"',
  'multiple',
  'uploadClassifiedImage',
  'removeClassifiedImage',
  'removeClassifiedImages',
  'CLASSIFIEDS_MAX_IMAGES',
  'CLASSIFIEDS_MAX_IMAGE_SIZE_MB',
  'formData.midias.length === 0',
  'p_midias: formData.midias.map',
];

for (const contract of requiredWizardContracts) {
  if (!wizard.includes(contract)) {
    throw new Error(`Contrato de upload real ausente no wizard: ${contract}`);
  }
}

const requiredStorageContracts = [
  "CLASSIFIEDS_MEDIA_BUCKET = 'classificados-midias'",
  "new Set(['image/jpeg', 'image/png', 'image/webp'])",
  '.upload(path, input.file',
  '.getPublicUrl(path)',
  '.remove([normalized])',
  'crypto.randomUUID()',
];

for (const contract of requiredStorageContracts) {
  if (!storage.includes(contract)) {
    throw new Error(`Contrato de Storage ausente: ${contract}`);
  }
}

const requiredMigrationContracts = [
  "'classificados-midias'",
  '8388608',
  "ARRAY['image/jpeg', 'image/png', 'image/webp']",
  'classificados_midias_leitura_publica',
  'classificados_midias_inserir_proprio_diretorio',
  'classificados_midias_atualizar_proprio_diretorio',
  'classificados_midias_excluir_proprio_diretorio',
  'public.gsa_jwt_session_is_valid()',
  'public.gsa_jwt_actor_id()',
];

for (const contract of requiredMigrationContracts) {
  if (!migration.includes(contract)) {
    throw new Error(`Contrato da migration de Storage ausente: ${contract}`);
  }
}

console.log('Classificados validados para upload real de imagens em produção.');
