import { runSshScript } from './ssh2-run.mjs';
const code = String.raw`
const crypto=require('node:crypto');const{Pool}=require('pg');
const key=String(process.env.GEMINI_BOOTSTRAP_KEY||'').trim();const master=String(process.env.GSA_TV_SECRET_KEY||'').trim();
if(!key||!master.match(/^[0-9a-f]{64}$/i))throw new Error('bootstrap prerequisites missing');
const b64=b=>Buffer.from(b).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const iv=crypto.randomBytes(12);const cipher=crypto.createCipheriv('aes-256-gcm',Buffer.from(master,'hex'),iv);const body=Buffer.concat([cipher.update(key,'utf8'),cipher.final()]);const encrypted='v1.'+b64(iv)+'.'+b64(Buffer.concat([body,cipher.getAuthTag()]));
const p=new Pool({connectionString:process.env.DATABASE_URL});(async()=>{await p.query("insert into public.gsa_tv_ai_provider_secrets(channel_id,provider,api_key_ciphertext,default_model,image_model,speech_model,video_model,settings,configured_by,updated_at) values('ch-main','gemini',$1,'gemini-2.5-flash','gemini-3.1-flash-image','gemini-3.1-flash-tts-preview','veo-3.1-generate-preview','{}','bootstrap-existing-gemini',now()) on conflict(channel_id,provider) do update set api_key_ciphertext=excluded.api_key_ciphertext,default_model=excluded.default_model,image_model=excluded.image_model,speech_model=excluded.speech_model,video_model=excluded.video_model,configured_by=excluded.configured_by,updated_at=now()",[encrypted]);const r=await p.query("select provider,default_model,image_model,speech_model,video_model,(api_key_ciphertext is not null) configured from public.gsa_tv_ai_provider_secrets where channel_id='ch-main' and provider='gemini'");console.log(JSON.stringify(r.rows[0]));await p.end()})().catch(e=>{console.error(e.message);process.exit(1)});
`;
const code64=Buffer.from(code).toString('base64');
const script=`sudo bash -lc 'set -a; source /etc/gsa-webhook.env; set +a; test -n "$GEMINI_API_KEY"; printf "%s" "${code64}" | base64 -d | docker exec -i -e GEMINI_BOOTSTRAP_KEY="$GEMINI_API_KEY" gsa-tv-control-plane node'`;
const result=await runSshScript(script,60000);
process.stdout.write(result.stdout);
if(result.stderr)process.stderr.write(result.stderr);
