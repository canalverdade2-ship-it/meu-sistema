import fs from 'node:fs';
const envPath = new URL('../.env', import.meta.url);
const envText = fs.readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split(/\r?\n/).filter(Boolean).map((line) => {
  const i = line.indexOf('=');
  return i > 0 ? [line.slice(0, i).trim(), line.slice(i + 1).trim()] : ['', ''];
}));
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Supabase URL/anon key ausentes no .env');
const res = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
if (!res.ok) throw new Error(`OpenAPI HTTP ${res.status}`);
const spec = await res.json();
const paths = spec.paths || {};
for (const fn of ['gsa_client_request_preapproved_credit_100','gsa_admin_approve_preapproved_credit_100']) {
  console.log(`${fn}|${Boolean(paths[`/rpc/${fn}`])}`);
}
