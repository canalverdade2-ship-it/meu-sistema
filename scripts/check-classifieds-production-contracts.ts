import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const wizardPath = path.join(root, 'src/components/client/marketplace/classifieds/CreateListingWizard.tsx');
const storagePath = path.join(root, 'src/lib/classifiedStorage.ts');
const edgeFunctionPath = path.join(root, 'supabase/functions/gsa-classified-media/index.ts');
const migrationPath = path.join(root, 'supabase/migrations/20260721183000_classifieds_media_storage_production.sql');

for (const filePath of [wizardPath, storagePath, edgeFunctionPath, migrationPath]) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo obrigatório dos Classificados ausente: ${path.relative(root, filePath)}`);
  }
}

const wizard = fs.readFileSync(wizardPath, 'utf8');
const storage = fs.readFileSync(storagePath, 'utf8');
const edgeFunction = fs.readFileSync(edgeFunctionPath, 'utf8');
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

const requiredClientGatewayContracts = [
  "CLASSIFIEDS_MEDIA_BUCKET = 'classificados-midias'",
  "new Set(['image/jpeg', 'image/png', 'image/webp'])",
  "supabase.functions.invoke('gsa-classified-media'",
  "body.append('action', 'upload')",
  "body: { action: 'delete', paths: normalized }",
];

for (const contract of requiredClientGatewayContracts) {
  if (!storage.includes(contract)) {
    throw new Error(`Contrato do gateway de mídias ausente: ${contract}`);
  }
}

if (/supabase\.storage\.from\([^)]*\)\.(upload|remove)/.test(storage)) {
  throw new Error('O navegador voltou a escrever diretamente no Storage dos Classificados.');
}

const requiredEdgeFunctionContracts = [
  "const BUCKET = 'classificados-midias'",
  "Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')",
  'admin.auth.getUser(accessToken)',
  "metadata.gsa_actor_type !== 'cliente'",
  "userClient.rpc('gsa_jwt_session_is_valid')",
  ".from('clientes')",
  'validImageSignature(file)',
  'file.size > MAX_IMAGE_BYTES',
  'pathBelongsToClient(path, authenticated.clientId)',
  'authenticated.admin.storage.from(BUCKET).upload',
  'authenticated.admin.storage.from(BUCKET).remove',
];

for (const contract of requiredEdgeFunctionContracts) {
  if (!edgeFunction.includes(contract)) {
    throw new Error(`Contrato de segurança ausente na Edge Function: ${contract}`);
  }
}

const requiredMigrationContracts = [
  "'classificados-midias'",
  '8388608',
  "ARRAY['image/jpeg', 'image/png', 'image/webp']",
  'ON CONFLICT (id) DO UPDATE',
];

for (const contract of requiredMigrationContracts) {
  if (!migration.includes(contract)) {
    throw new Error(`Contrato da migration de Storage ausente: ${contract}`);
  }
}

if (/CREATE\s+POLICY|SET\s+(LOCAL\s+)?ROLE/i.test(migration)) {
  throw new Error('A migration voltou a depender de escrita direta ou troca de proprietário do Storage.');
}

console.log('Classificados validados para upload real por gateway autenticado de produção.');
