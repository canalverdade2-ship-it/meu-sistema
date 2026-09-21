import fs from 'node:fs';
import crypto from 'node:crypto';
const root = String.raw`C:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)`;
const files = ['gsa-auth-session.ts','gsa-ads-public.ts','gsa-ads-admin.ts','supabase/functions/gsa-ads-public/index.ts','supabase/functions/gsa-ads-admin/index.ts','src/pages/AdvertiserPortal.tsx','supabase/migrations/20260830003000_harden_advertising_end_to_end.sql'];
let bad = 0;
for (const rel of files) {
  const buf = fs.readFileSync(`${root}\\${rel.replaceAll('/', '\\')}`);
  let text = '';
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { bad++; console.log(`${rel}|INVALID_UTF8`); continue; }
  if (text.includes('\uFFFD') || /Ã.|Â.|â€|ðŸ/.test(text)) { bad++; console.log(`${rel}|MOJIBAKE`); continue; }
  console.log(`${rel}|OK|${crypto.createHash('sha256').update(buf).digest('hex')}`);
}
console.log(`UTF8_BAD=${bad}`);
process.exitCode = bad ? 1 : 0;
