const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const migrationsDir = path.join(root, 'supabase', 'migrations');
const masterSchemaFile = path.join(root, 'master_supabase_schema.sql');
const functionsDir = path.join(root, 'supabase', 'functions');

console.log('=== COMPREHENSIVE BACKEND & DB CATALOG PARSER ===');

// 1. Gather all SQL files
const sqlFiles = [];
if (fs.existsSync(masterSchemaFile)) {
  sqlFiles.push(masterSchemaFile);
}
if (fs.existsSync(migrationsDir)) {
  const mFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  mFiles.forEach(f => sqlFiles.push(path.join(migrationsDir, f)));
}

const tables = new Map(); // name -> { name, columns: Map, pks: Set, fks: [], rlsPolicies: [], triggers: [], indexes: [], sources: Set }
const rpcs = new Map(); // name -> { name, args, returns, isSecurityDefiner, sources: Set }
const triggers = new Map(); // name -> { name, table, event, sources: Set }
const policies = new Map(); // name -> { name, table, command, roles, using, check, sources: Set }

for (const filePath of sqlFiles) {
  const relPath = path.relative(root, filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf8');

  // Match CREATE TABLE
  // Handles CREATE TABLE [IF NOT EXISTS] [public.]["table_name"] (
  const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?["'`]?([a-zA-Z0-9_]+)["'`]?\s*\(([\s\S]*?)(?:\n\);|\n\);\s*$|\);)/gi;
  let match;
  while ((match = createTableRegex.exec(content)) !== null) {
    const tableName = match[1].toLowerCase();
    const body = match[2];
    if (!tables.has(tableName)) {
      tables.set(tableName, {
        name: tableName,
        columns: new Map(),
        pks: new Set(),
        fks: [],
        rlsPolicies: [],
        triggers: [],
        indexes: [],
        sources: new Set()
      });
    }
    const t = tables.get(tableName);
    t.sources.add(relPath);

    // Parse body lines
    const lines = body.split('\n');
    for (let rawLine of lines) {
      const line = rawLine.trim().replace(/,$/, '');
      if (!line || line.startsWith('--')) continue;

      // Primary Key constraint
      if (/PRIMARY\s+KEY\s*\(([^)]+)\)/i.test(line)) {
        const pkm = line.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
        if (pkm) {
          pkm[1].split(',').forEach(col => t.pks.add(col.trim().replace(/["'`]/g, '')));
        }
        continue;
      }
      // Foreign Key constraint
      if (/FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:public\.)?([a-zA-Z0-9_]+)(?:\(([^)]+)\))?/i.test(line)) {
        const fkm = line.match(/FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:public\.)?([a-zA-Z0-9_]+)(?:\(([^)]+)\))?/i);
        if (fkm) {
          t.fks.push({
            column: fkm[1].trim().replace(/["'`]/g, ''),
            targetTable: fkm[2].trim().toLowerCase(),
            targetColumn: (fkm[3] || 'id').trim().replace(/["'`]/g, '')
          });
        }
        continue;
      }

      // Column definition
      const colMatch = line.match(/^["'`]?([a-zA-Z0-9_]+)["'`]?\s+([a-zA-Z0-9_]+(?:\([^)]+\))?(?:\[\])?)/i);
      if (colMatch) {
        const colName = colMatch[1].toLowerCase();
        const colType = colMatch[2];
        const isPk = /PRIMARY\s+KEY/i.test(line);
        if (isPk) t.pks.add(colName);

        const refMatch = line.match(/REFERENCES\s+(?:public\.)?([a-zA-Z0-9_]+)(?:\(([^)]+)\))?/i);
        if (refMatch) {
          t.fks.push({
            column: colName,
            targetTable: refMatch[1].trim().toLowerCase(),
            targetColumn: (refMatch[2] || 'id').trim().replace(/["'`]/g, '')
          });
        }

        if (!t.columns.has(colName)) {
          t.columns.set(colName, {
            name: colName,
            type: colType,
            isPk,
            nullable: !/NOT\s+NULL/i.test(line),
            hasDefault: /DEFAULT/i.test(line)
          });
        }
      }
    }
  }

  // Also catch simple CREATE TABLE declarations if multi-line regex missed any
  const simpleTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?["'`]?([a-zA-Z0-9_]+)["'`]?\s*\(/gi;
  while ((match = simpleTableRegex.exec(content)) !== null) {
    const tableName = match[1].toLowerCase();
    if (!tables.has(tableName)) {
      tables.set(tableName, {
        name: tableName,
        columns: new Map(),
        pks: new Set(),
        fks: [],
        rlsPolicies: [],
        triggers: [],
        indexes: [],
        sources: new Set([relPath])
      });
    } else {
      tables.get(tableName).sources.add(relPath);
    }
  }

  // ALTER TABLE ADD COLUMN
  const addColRegex = /ALTER\s+TABLE\s+(?:ONLY\s+)?(?:public\.)?["'`]?([a-zA-Z0-9_]+)["'`]?\s+ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?["'`]?([a-zA-Z0-9_]+)["'`]?\s+([a-zA-Z0-9_]+(?:\([^)]+\))?(?:\[\])?)/gi;
  while ((match = addColRegex.exec(content)) !== null) {
    const tableName = match[1].toLowerCase();
    const colName = match[2].toLowerCase();
    const colType = match[3];
    if (tables.has(tableName)) {
      const t = tables.get(tableName);
      if (!t.columns.has(colName)) {
        t.columns.set(colName, {
          name: colName,
          type: colType,
          isPk: false,
          nullable: true,
          hasDefault: /DEFAULT/i.test(match[0])
        });
      }
      t.sources.add(relPath);
    }
  }

  // CREATE INDEX
  const indexRegex = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)\s+ON\s+(?:public\.)?["'`]?([a-zA-Z0-9_]+)["'`]?/gi;
  while ((match = indexRegex.exec(content)) !== null) {
    const idxName = match[1];
    const tableName = match[2].toLowerCase();
    if (tables.has(tableName)) {
      const t = tables.get(tableName);
      if (!t.indexes.includes(idxName)) t.indexes.push(idxName);
    }
  }

  // CREATE TRIGGER
  const triggerRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+([a-zA-Z0-9_]+)\s+([\s\S]*?)\s+ON\s+(?:public\.)?["'`]?([a-zA-Z0-9_]+)["'`]?/gi;
  while ((match = triggerRegex.exec(content)) !== null) {
    const trgName = match[1];
    const tableName = match[3].toLowerCase();
    if (tables.has(tableName)) {
      const t = tables.get(tableName);
      if (!t.triggers.includes(trgName)) t.triggers.push(trgName);
    }
    if (!triggers.has(trgName)) {
      triggers.set(trgName, { name: trgName, table: tableName, sources: new Set([relPath]) });
    } else {
      triggers.get(trgName).sources.add(relPath);
    }
  }

  // CREATE POLICY
  const policyRegex = /CREATE\s+POLICY\s+["']?([^"'\n]+)["']?\s+ON\s+(?:public\.)?["'`]?([a-zA-Z0-9_]+)["'`]?(?:[\s\S]*?(?:FOR\s+([A-Z]+))?[\s\S]*?(?:TO\s+([a-zA-Z0-9_,\s]+))?[\s\S]*?;)/gi;
  while ((match = policyRegex.exec(content)) !== null) {
    const polName = match[1].trim();
    const tableName = match[2].toLowerCase();
    const cmd = match[3] || 'ALL';
    const roles = match[4] ? match[4].trim() : 'public';
    const polKey = `${tableName}::${polName}`;
    if (tables.has(tableName)) {
      const t = tables.get(tableName);
      if (!t.rlsPolicies.includes(polName)) t.rlsPolicies.push(polName);
    }
    if (!policies.has(polKey)) {
      policies.set(polKey, { name: polName, table: tableName, command: cmd, roles, sources: new Set([relPath]) });
    } else {
      policies.get(polKey).sources.add(relPath);
    }
  }

  // CREATE FUNCTION / RPC
  const funcRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\)\s*RETURNS\s+([a-zA-Z0-9_]+(?:\s*TABLE\s*\([\s\S]*?\)|\[\])?)/gi;
  while ((match = funcRegex.exec(content)) !== null) {
    const fnName = match[1].toLowerCase();
    const args = match[2].replace(/\s+/g, ' ').trim();
    const ret = match[3].replace(/\s+/g, ' ').trim();
    const fnSub = content.slice(match.index, match.index + 800);
    const isSecurityDefiner = /SECURITY\s+DEFINER/i.test(fnSub);

    if (!rpcs.has(fnName)) {
      rpcs.set(fnName, {
        name: fnName,
        args,
        returns: ret,
        isSecurityDefiner,
        sources: new Set([relPath])
      });
    } else {
      const r = rpcs.get(fnName);
      r.sources.add(relPath);
      if (isSecurityDefiner) r.isSecurityDefiner = true;
    }
  }
}

// 2. Parse Edge Functions
const edgeFunctions = [];
if (fs.existsSync(functionsDir)) {
  const dirs = fs.readdirSync(functionsDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== '_shared');
  
  dirs.forEach(d => {
    const fnDir = path.join(functionsDir, d.name);
    const indexPath = path.join(fnDir, 'index.ts');
    let hasIndex = fs.existsSync(indexPath);
    let actions = [];
    let method = 'POST';
    if (hasIndex) {
      const content = fs.readFileSync(indexPath, 'utf8');
      const actionMatches = content.match(/action\s*===?\s*['"]([^'"]+)['"]/g) || [];
      actions = actionMatches.map(a => a.replace(/action\s*===?\s*['"]/, '').replace(/['"]$/, ''));
      actions = [...new Set(actions)];
      if (/req\.method\s*===?\s*['"]GET['"]/i.test(content)) method = 'GET/POST';
    }
    edgeFunctions.push({
      name: d.name,
      entrypoint: `supabase/functions/${d.name}/index.ts`,
      method,
      actions
    });
  });
}

// 3. VPS Webhooks from server_webhook.cjs
const vpsWebhooks = [
  {
    path: '/',
    method: 'GET',
    handler: 'Health Check',
    purpose: 'Liveness heartbeat, active sessions count and server info'
  },
  {
    path: '/health',
    method: 'GET',
    handler: 'Health Check',
    purpose: 'Liveness check alias'
  },
  {
    path: '/ping',
    method: 'GET',
    handler: 'Health Check',
    purpose: 'Fast latency ping probe'
  },
  {
    path: '/feeds/viagens',
    method: 'GET',
    handler: 'Travel Package Feed',
    purpose: 'Returns JSON array of all national, international and promo travel packages'
  },
  {
    path: '/feeds/viagens/nacionais',
    method: 'GET',
    handler: 'National Travel Feed',
    purpose: 'Returns curated national travel packages'
  },
  {
    path: '/feeds/viagens/internacionais',
    method: 'GET',
    handler: 'International Travel Feed',
    purpose: 'Returns international travel packages'
  },
  {
    path: '/feeds/viagens/promoc',
    method: 'GET',
    handler: 'Promo Travel Feed',
    purpose: 'Returns promotional and discounted packages'
  },
  {
    path: '/feeds/viagens/*.csv',
    method: 'GET',
    handler: 'CSV Travel Export',
    purpose: 'Exports travel catalog as CSV with full pricing, days, nights, hotel tier'
  },
  {
    path: '/api/dropship-search',
    method: 'GET',
    handler: 'Dropship Product Search API',
    purpose: 'Searches dropship catalog with query param ?q=, returns models with markup'
  },
  {
    path: '/webhook',
    method: 'GET',
    handler: 'Meta / WhatsApp Webhook Challenge Verification',
    purpose: 'Verifies webhook challenge (hub.mode=subscribe & hub.verify_token)'
  },
  {
    path: '/webhook',
    method: 'POST',
    handler: 'Evolution API & Meta Webhook Message Receiver',
    purpose: 'Receives incoming WhatsApp messages, dispatches through SessionMutex to Gemini/Chatbot'
  },
  {
    path: '/webhook/supabase-update',
    method: 'POST',
    handler: 'Supabase Realtime DB Webhook Handler',
    purpose: 'Handles database change triggers dispatched from Supabase PostgreSQL'
  },
  {
    path: '/webhook/gsa-produtos-scraping',
    method: 'POST',
    handler: 'Product Scraping Webhook',
    purpose: 'Receives scraped marketplace products from Shopee/external feeds'
  },
  {
    path: '/webhook/gsa-viagens-scraping',
    method: 'POST',
    handler: 'Travel Scraping Webhook',
    purpose: 'Receives updated scraping feeds for airline flights and hotels'
  },
  {
    path: '/webhook/scraping',
    method: 'POST',
    handler: 'Generic Scraping Webhook',
    purpose: 'Alias for scraping ingestion'
  }
];

// 4. Assign Unique Traceability Identifiers
const sortedTables = Array.from(tables.values()).sort((a, b) => a.name.localeCompare(b.name));
const tableCatalog = sortedTables.map((t, idx) => ({
  id: `DB-TBL-${String(idx + 1).padStart(3, '0')}`,
  name: t.name,
  columnCount: t.columns.size,
  columns: Array.from(t.columns.values()),
  primaryKeys: Array.from(t.pks),
  foreignKeys: t.fks,
  indexes: t.indexes,
  triggers: t.triggers,
  rlsPolicies: t.rlsPolicies,
  sources: Array.from(t.sources)
}));

const sortedRpcs = Array.from(rpcs.values()).sort((a, b) => a.name.localeCompare(b.name));
const rpcCatalog = sortedRpcs.map((r, idx) => ({
  id: `DB-RPC-${String(idx + 1).padStart(3, '0')}`,
  name: r.name,
  args: r.args,
  returns: r.returns,
  isSecurityDefiner: r.isSecurityDefiner,
  sources: Array.from(r.sources)
}));

const edgeCatalog = edgeFunctions.map((e, idx) => ({
  id: `API-EDGE-${String(idx + 1).padStart(3, '0')}`,
  name: e.name,
  entrypoint: e.entrypoint,
  method: e.method,
  actions: e.actions
}));

const whCatalog = vpsWebhooks.map((w, idx) => ({
  id: `API-WH-${String(idx + 1).padStart(3, '0')}`,
  path: w.path,
  method: w.method,
  handler: w.handler,
  purpose: w.purpose
}));

// External integrations endpoints
const externalEndpoints = [
  {
    id: 'API-END-001',
    service: 'Evolution API WhatsApp Send Text',
    url: 'http://147.15.43.141:8080/message/sendText/GSA_WhatsApp',
    method: 'POST',
    auth: 'apikey header',
    source: 'src/utils/n8nWhatsApp.ts'
  },
  {
    id: 'API-END-002',
    service: 'Evolution API WhatsApp Send Media',
    url: 'http://147.15.43.141:8080/message/sendMedia/GSA_WhatsApp',
    method: 'POST',
    auth: 'apikey header',
    source: 'src/utils/n8nWhatsApp.ts'
  },
  {
    id: 'API-END-003',
    service: 'Evolution API Connection State Check',
    url: 'http://147.15.43.141:8080/instance/connectionState/GSA_WhatsApp',
    method: 'GET',
    auth: 'apikey header',
    source: 'src/lib/whatsappHealthService.ts'
  },
  {
    id: 'API-END-004',
    service: 'n8n Webhook WhatsApp Fallback',
    url: 'http://147.15.43.141:5678/webhook/send-whatsapp',
    method: 'POST',
    auth: 'public webhook / header',
    source: 'src/utils/n8nWhatsApp.ts'
  },
  {
    id: 'API-END-005',
    service: 'InfinitePay Checkout V2 Orders',
    url: 'https://api.infinitepay.io/v2/transactions',
    method: 'POST',
    auth: 'Bearer token',
    source: 'src/utils/infinitePay.ts'
  },
  {
    id: 'API-END-006',
    service: 'Cloudflare R2 Public CDN',
    url: 'https://pub-7f7b1419c83c407ba9bcf6512329e79a.r2.dev',
    method: 'GET',
    auth: 'Public',
    source: 'src/lib/r2Storage.ts'
  },
  {
    id: 'API-END-007',
    service: 'Cloudflare R2 Worker Auth Proxy',
    url: 'https://gsa-hub-r2-worker.r2-handler.workers.dev',
    method: 'GET/POST/PUT/DELETE',
    auth: 'x-gsa-session-id, x-gsa-session-token',
    source: 'src/lib/r2StorageWorkerClient.ts'
  },
  {
    id: 'API-END-008',
    service: 'Google Gemini 3.5 Flash NLU',
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
    method: 'POST',
    auth: 'GEMINI_API_KEY query param',
    source: 'server_webhook.cjs'
  },
  {
    id: 'API-END-009',
    service: 'ViaCEP Postal Code Lookup',
    url: 'https://viacep.com.br/ws/{cep}/json/',
    method: 'GET',
    auth: 'Public',
    source: 'src/components/client/AddressStep.tsx'
  },
  {
    id: 'API-END-010',
    service: 'BrasilAPI CNPJ Lookup',
    url: 'https://brasilapi.com.br/api/cnpj/v1/{cnpj}',
    method: 'GET',
    auth: 'Public',
    source: 'src/utils/documentValidation.ts'
  }
];

const catalog = {
  metadata: {
    generatedAt: new Date().toISOString(),
    sqlFilesCount: sqlFiles.length,
    totalTables: tableCatalog.length,
    totalRpcs: rpcCatalog.length,
    totalEdgeFunctions: edgeCatalog.length,
    totalVpsWebhooks: whCatalog.length,
    totalExternalEndpoints: externalEndpoints.length
  },
  tables: tableCatalog,
  rpcs: rpcCatalog,
  edgeFunctions: edgeCatalog,
  vpsWebhooks: whCatalog,
  externalEndpoints: externalEndpoints
};

fs.writeFileSync(path.join(__dirname, 'catalog_complete.json'), JSON.stringify(catalog, null, 2), 'utf8');
console.log('--- CATALOG SUMMARY ---');
console.log(`- Tables Cataloged: ${tableCatalog.length}`);
console.log(`- RPC Functions: ${rpcCatalog.length}`);
console.log(`- Edge Functions: ${edgeCatalog.length}`);
console.log(`- VPS Webhook Endpoints: ${whCatalog.length}`);
console.log(`- External Endpoints: ${externalEndpoints.length}`);
console.log('Saved catalog_complete.json successfully.');
