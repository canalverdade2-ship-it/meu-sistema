import { readFileSync, writeFileSync } from 'node:fs';

const updates = [];

function updateFile(path, transform) {
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (after !== before) {
    writeFileSync(path, after, 'utf8');
    updates.push(path);
  }
}

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Padrao nao encontrado: ${label}`);
  return source.replace(before, after);
}

updateFile('supabase/functions/gsa-public-advertising/index.ts', (source) => {
  source = replaceRequired(
    source,
    `function corsHeaders(origin: string | null) {\n  const allowed = origin || '*';\n  return {\n    'access-control-allow-origin': allowed,\n    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-custom-header',\n    'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',\n    'access-control-max-age': '86400',\n    vary: 'Origin',\n  };\n}`,
    `function corsHeaders(origin: string | null) {\n  return {\n    ...(origin ? { 'access-control-allow-origin': origin } : {}),\n    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-custom-header',\n    'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',\n    'access-control-max-age': '86400',\n    vary: 'Origin',\n  };\n}`,
    'cabecalhos CORS sem wildcard implicito',
  );

  source = replaceRequired(
    source,
    `export async function handleRequest(request: Request) {\n  const origin = request.headers.get('origin');\n  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });\n  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' }, origin, { allow: 'POST, OPTIONS' });`,
    `export async function handleRequest(request: Request) {\n  const origin = request.headers.get('origin');\n  const allowedOrigin = origin && configuredOrigins().includes(origin) ? origin : null;\n  if (origin && !allowedOrigin) return json(403, { error: 'origin_not_allowed' }, null);\n  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(allowedOrigin) });\n  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' }, allowedOrigin, { allow: 'POST, OPTIONS' });`,
    'validacao de origem antes do preflight',
  );

  source = source.replaceAll(', origin)', ', allowedOrigin)');
  source = source.replaceAll(', origin, {', ', allowedOrigin, {');
  return source;
});

updateFile('supabase/functions/_shared/html_parser.ts', (source) => {
  source = replaceRequired(
    source,
    `export interface ParsedProduct {\n  candidate_id?: string;\n  nome: string | null;\n  descricao: string | null;\n  preco: number | null;\n  moeda: string | null;\n  nome_fornecedor: string | null;\n  imagens: string[];\n  origem_campos: Record<string, string>;\n}\n`,
    `export interface ParsedProduct {\n  candidate_id?: string;\n  nome: string | null;\n  descricao: string | null;\n  preco: number | null;\n  moeda: string | null;\n  nome_fornecedor: string | null;\n  imagens: string[];\n  origem_campos: Record<string, string>;\n}\n\nfunction parsePriceAmount(value: unknown): number | null {\n  const raw = String(value ?? '').trim().replace(/\\s+/g, '').replace(/[^0-9,.-]/g, '');\n  if (!raw) return null;\n\n  const commaIndex = raw.lastIndexOf(',');\n  const dotIndex = raw.lastIndexOf('.');\n  let normalized = raw;\n\n  if (commaIndex >= 0 && dotIndex >= 0) {\n    const decimalSeparator = commaIndex > dotIndex ? ',' : '.';\n    const thousandsSeparator = decimalSeparator === ',' ? /\\./g : /,/g;\n    normalized = raw.replace(thousandsSeparator, '').replace(decimalSeparator, '.');\n  } else if (commaIndex >= 0) {\n    const decimalDigits = raw.length - commaIndex - 1;\n    normalized = decimalDigits === 1 || decimalDigits === 2\n      ? raw.replace(/\\./g, '').replace(',', '.')\n      : raw.replace(/,/g, '');\n  } else if (dotIndex >= 0) {\n    const decimalDigits = raw.length - dotIndex - 1;\n    const dotCount = (raw.match(/\\./g) || []).length;\n    normalized = dotCount === 1 && (decimalDigits === 1 || decimalDigits === 2)\n      ? raw\n      : raw.replace(/\\./g, '');\n  }\n\n  const parsed = Number(normalized);\n  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;\n}\n`,
    'normalizador monetario compartilhado',
  );

  source = source.replace(
    `const numPrice = parseFloat(String(price).replace(/[^0-9.]/g, ''));\n                if (!isNaN(numPrice) && numPrice > 0) {`,
    `const numPrice = parsePriceAmount(price);\n                if (numPrice !== null) {`,
  );
  source = source.replace(
    `const p = parseFloat(ogPrice.getAttribute('content')!.replace(/[^0-9.]/g, ''));\n      if (!isNaN(p) && p > 0) {`,
    `const p = parsePriceAmount(ogPrice.getAttribute('content'));\n      if (p !== null) {`,
  );
  source = source.replace(
    `const numPrice = parseFloat(String(price).replace(/[^0-9.]/g, ''));\n                if (!isNaN(numPrice) && numPrice > 0) {`,
    `const numPrice = parsePriceAmount(price);\n                if (numPrice !== null) {`,
  );
  return source;
});

updateFile('supabase/functions/_shared/html_parser_test.ts', (source) => {
  source = replaceRequired(
    source,
    `  console.log(\`\\nTests finished: \${passed} passed, \${failed} failed.\`);\n}\n\nrunTests();`,
    `  console.log(\`\\nTests finished: \${passed} passed, \${failed} failed.\`);\n  if (failed > 0) throw new Error(\`HTML Parser: \${failed} teste(s) falharam.\`);\n}\n\nawait runTests();`,
    'falha real do runner do parser',
  );
  return source;
});

console.log(`Correcoes deterministicas aplicadas em ${updates.length} arquivo(s).`);
