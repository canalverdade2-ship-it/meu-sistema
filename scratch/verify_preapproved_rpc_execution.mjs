import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/).filter(Boolean).map((line) => { const i=line.indexOf('='); return i>0?[line.slice(0,i).trim(),line.slice(i+1).trim()]:['','']; }));
const base=env.VITE_SUPABASE_URL, key=env.VITE_SUPABASE_ANON_KEY;
const fake='00000000-0000-0000-0000-000000000000';
const tests=[
  ['gsa_client_request_preapproved_credit_100',{p_sessao_id:fake,p_session_token:'invalid-test-token'}],
  ['gsa_admin_approve_preapproved_credit_100',{p_sessao_id:fake,p_session_token:'invalid-test-token',p_solicitacao_id:fake}],
];
for (const [fn,body] of tests) {
  const r=await fetch(`${base}/rest/v1/rpc/${fn}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const text=await r.text();
  const found=!/schema cache|Could not find the function/i.test(text);
  console.log(`${fn}|HTTP=${r.status}|function_found=${found}`);
}
