import fs from 'node:fs';
const p = String.raw`C:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\gsa-auth-session.ts`;
let s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const old = "import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';";
const next = old + "\nimport { handleRequest as handleAdsPublic } from './gsa-ads-public.ts';\nimport { handleRequest as handleAdsAdmin } from './gsa-ads-admin.ts';";
if (!s.includes('handleAdsPublic')) { if (!s.includes(old)) throw new Error('import marker missing'); s = s.replace(old, next); }
const marker = "export async function handleRequest(request: Request) {\n  const endpointPath = new URL(request.url).pathname;";
const routed = marker + "\n  if (endpointPath.endsWith('/gsa-ads-public')) return handleAdsPublic(request);\n  if (endpointPath.endsWith('/gsa-ads-admin')) return handleAdsAdmin(request);";
if (!s.includes("endpointPath.endsWith('/gsa-ads-public')")) { if (!s.includes(marker)) throw new Error('handler marker missing'); s = s.replace(marker, routed); }
fs.writeFileSync(p, s, 'utf8');
console.log('dispatcher patched');
