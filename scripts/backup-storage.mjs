import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar configuradas em secrets seguros.');
}

const outputRoot = process.argv[2] || 'backups';
const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const backupDirectory = path.resolve(outputRoot, `storage-${timestamp}`);
const maxObjects = Number(process.env.STORAGE_BACKUP_MAX_OBJECTS || 100_000);
const pageSize = 1_000;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function safePathSegment(value) {
  const normalized = String(value || '').replace(/[^a-zA-Z0-9._-]+/g, '_');
  if (!normalized || normalized === '.' || normalized === '..') throw new Error('Segmento de caminho inválido.');
  return normalized;
}

function safeObjectPath(objectName) {
  const normalized = path.posix.normalize(`/${String(objectName || '')}`).slice(1);
  if (!normalized || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error(`Caminho inseguro no Storage: ${objectName}`);
  }
  return normalized.split('/').map(safePathSegment).join('/');
}

async function sha256(filePath) {
  const content = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function listDirectory(bucketId, prefix = '') {
  const entries = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(bucketId).list(prefix, {
      limit: pageSize,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw new Error(`Falha ao listar ${bucketId}/${prefix}: ${error.message}`);

    const page = data || [];
    entries.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  return entries;
}

async function backupBucket(bucket, manifest) {
  const bucketId = bucket.id || bucket.name;
  const safeBucket = safePathSegment(bucketId);
  const bucketDirectory = path.join(backupDirectory, 'objects', safeBucket);
  await fs.mkdir(bucketDirectory, { recursive: true });

  async function visit(prefix = '') {
    const entries = await listDirectory(bucketId, prefix);
    for (const entry of entries) {
      const objectName = prefix ? `${prefix}/${entry.name}` : entry.name;
      const isDirectory = entry.id == null && entry.metadata == null;
      if (isDirectory) {
        await visit(objectName);
        continue;
      }

      if (manifest.objects.length >= maxObjects) {
        throw new Error(`Limite de segurança de ${maxObjects} objetos atingido.`);
      }

      const { data, error } = await supabase.storage.from(bucketId).download(objectName);
      if (error || !data) throw new Error(`Falha ao baixar ${bucketId}/${objectName}: ${error?.message || 'sem dados'}`);

      const relativePath = safeObjectPath(objectName);
      const destination = path.join(bucketDirectory, relativePath);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      const buffer = Buffer.from(await data.arrayBuffer());
      await fs.writeFile(destination, buffer, { mode: 0o600 });

      manifest.objects.push({
        bucket: bucketId,
        object_name: objectName,
        backup_path: path.relative(backupDirectory, destination).replaceAll(path.sep, '/'),
        bytes: buffer.length,
        sha256: await sha256(destination),
        content_type: entry.metadata?.mimetype || data.type || null,
        updated_at: entry.updated_at || null,
      });
    }
  }

  await visit();
}

await fs.mkdir(backupDirectory, { recursive: true, mode: 0o700 });
const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
if (bucketsError) throw new Error(`Falha ao listar buckets: ${bucketsError.message}`);

const manifest = {
  created_at_utc: new Date().toISOString(),
  source_project: new URL(supabaseUrl).hostname.split('.')[0],
  buckets: (buckets || []).map((bucket) => ({
    id: bucket.id,
    name: bucket.name,
    public: bucket.public,
    file_size_limit: bucket.file_size_limit ?? null,
    allowed_mime_types: bucket.allowed_mime_types ?? null,
  })),
  objects: [],
};

for (const bucket of buckets || []) await backupBucket(bucket, manifest);

await fs.writeFile(
  path.join(backupDirectory, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  { mode: 0o600 },
);

console.log(`STORAGE_BACKUP_OK=${backupDirectory}`);
console.log(`STORAGE_OBJECTS_BACKED_UP=${manifest.objects.length}`);
