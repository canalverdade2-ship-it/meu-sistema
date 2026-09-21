import { runSshScript } from './ssh2-run.mjs';
const remote=String.raw`sudo docker exec -e NODE_PATH=/app/node_modules gsa-tv-control-plane node - <<'NODE'
const{Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DATABASE_URL});const q=await p.query("select * from public.gsa_tv_ai_provider_secrets where channel_id='ch-main' and provider='gemini' order by updated_at desc limit 1");console.log(Object.keys(q.rows[0]||{}).filter(k=>!k.includes('cipher')&&!k.includes('key')));console.log(Object.fromEntries(Object.entries(q.rows[0]||{}).filter(([k])=>k.includes('model'))));await p.end()})().catch(e=>{console.error(e);process.exit(1)})
NODE`;
const r=await runSshScript(remote,30000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
