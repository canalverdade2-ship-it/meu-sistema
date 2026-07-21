import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const wizardPath = path.join(root, 'src/components/client/marketplace/classifieds/CreateListingWizard.tsx');
const storagePath = path.join(root, 'src/lib/classifiedStorage.ts');
const gatewayPath = path.join(root, 'supabase/functions/gsa-classified-media/index.ts');
const migrationPath = path.join(root, 'supabase/migrations/20260721183000_classifieds_media_storage_production.sql');

for (const filePath of [wizardPath, storagePath, gatewayPath, migrationPath]) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo obrigatório dos Classificados ausente: ${path.relative(root, filePath)}`);
  }
}

const wizard = fs.readFileSync(wizardPath, 'utf8');
const storage = fs.readFileSync(storagePath, 'utf8');
const gateway = fs.readFileSync(gatewayPath, 'utf8');
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
  'type="file"',
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
  "supabase.functions.invoke('gsa-classified-media'",
  "body.append('action', 'upload')",
  "body: { action: 'delete', paths: normalized }",
  'crypto.randomUUID()',
];

for (const contract of requiredStorageContracts) {
  if (!storage.includes(contract)) {
    throw new Error(`Contrato do cliente de mídia ausente: ${contract}`);
  }
}

const forbiddenBrowserStoragePatterns = [
  /supabase\.storage\.from\([^)]*\)\.upload\(/,
  /supabase\.storage\.from\([^)]*\)\.remove\(/,
  /\.from\(CLASSIFIEDS_MEDIA_BUCKET\)\.upload\(/,
  /\.from\(CLASSIFIEDS_MEDIA_BUCKET\)\.remove\(/,
];
for (const pattern of forbiddenBrowserStoragePatterns) {
  if (pattern.test(storage) || pattern.test(wizard)) {
    throw new Error(`O navegador voltou a escrever diretamente no Storage: ${pattern}`);
  }
}

const requiredGatewayContracts = [
  "const BUCKET = 'classificados-midias'",
  'authenticateClient(request',
  "metadata.gsa_actor_type !== 'cliente'",
  "userClient.rpc('gsa_jwt_session_is_valid')",
  'validImageSignature(file)',
  'pathBelongsToClient(path, authenticated.clientId)',
  'authenticated.admin.storage.from(BUCKET).upload',
  'authenticated.admin.storage.from(BUCKET).remove',
  'configuredOrigins()',
];

for (const contract of requiredGatewayContracts) {
  if (!gateway.includes(contract)) {
    throw new Error(`Contrato do gateway de mídia ausente: ${contract}`);
  }
}

const requiredMigrationContracts = [
  "'classificados-midias'",
  '8388608',
  "ARRAY['image/jpeg', 'image/png', 'image/webp']",
  'gsa-classified-media com service role',
];
for (const contract of requiredMigrationContracts) {
  if (!migration.includes(contract)) {
    throw new Error(`Contrato da migration de Storage ausente: ${contract}`);
  }
}

const forbiddenMigrationContracts = [
  'classificados_midias_inserir_proprio_diretorio',
  'classificados_midias_atualizar_proprio_diretorio',
  'classificados_midias_excluir_proprio_diretorio',
  'TO authenticated\nWITH CHECK',
];
for (const contract of forbiddenMigrationContracts) {
  if (migration.includes(contract)) {
    throw new Error(`A migration voltou a conceder escrita direta no Storage: ${contract}`);
  }
}

console.log('Classificados validados com escrita exclusiva pelo gateway autenticado.');
