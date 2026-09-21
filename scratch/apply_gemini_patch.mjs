import fs from 'node:fs';
const appPath='infrastructure/gsa-tv/services/playout-api/src/app.js';
let s=fs.readFileSync(appPath,'utf8');
const py=fs.readFileSync('scratch/patch_gemini_provider.py','utf8');
const block=(name)=>{const m=py.match(new RegExp(`${name}=r'''([\\s\\S]*?)'''`));if(!m)throw new Error(`block ${name} missing`);return m[1].trim()+'\n'};
const replaceTo=(name,nextMarker,body)=>{const a=s.indexOf(`async function ${name}`);const b=s.indexOf(nextMarker,a);if(a<0||b<0)throw new Error(`${name}/${nextMarker} markers missing`);s=s.slice(0,a)+body+s.slice(b)};
if(!s.includes('const gemini = require("./gemini");'))s=s.replace('const { Pool } = require("pg");','const { Pool } = require("pg");\nconst gemini = require("./gemini");');
replaceTo('aiProviderStatus','async function configureAiProvider',block('provider_status'));
replaceTo('configureAiProvider','function responseOutputText',block('configure_provider'));
const aiSecret=`async function aiSecret(){const r=await pool.query("select * from public.gsa_tv_ai_provider_secrets where channel_id=$1 order by updated_at desc limit 1",[CHANNEL_ID]);if(!r.rowCount)throw new Error('Configure um provedor de IA no Laboratorio antes de executar.');return {...r.rows[0],api_key:decryptStreamKey(r.rows[0].api_key_ciphertext)}}\n`;
replaceTo('aiSecret','async function recordAiUsage',aiSecret);
const usage=`async function recordAiUsage(job,secret,operation,usage={},metadata={}){await pool.query(\`insert into public.gsa_tv_ai_usage(channel_id,project_id,job_id,provider,model,operation,input_units,output_units,metadata) values($1,$2,$3,$4,$5,$6,$7,$8,$9)\`,[CHANNEL_ID,job.project_id,job.id,secret.provider,job.model,operation,usage.input_tokens||usage.input_units||null,usage.output_tokens||usage.output_units||null,metadata])}\n`;
replaceTo('recordAiUsage','async function saveAiAsset',usage);
const marker='async function generateAiImage';
if(!s.includes('async function generateProviderText')){
  const at=s.indexOf(marker);if(at<0)throw new Error('generateAiImage marker missing');
  s=s.slice(0,at)+block('helpers')+block('more_helpers')+s.slice(at);
}
replaceTo('runAiProject','async function executeAiJob',block('run_project'));
replaceTo('executeAiJob','async function processAiJobs',block('execute_job'));
fs.writeFileSync(appPath,s);
console.log('gemini provider patch applied');
