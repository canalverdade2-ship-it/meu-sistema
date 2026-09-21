import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const creds = fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md', import.meta.url), 'utf8');
const key = creds.match(/Chave Privada:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
if (!key) throw new Error('Chave da VPS não encontrada.');
const enqueue = Buffer.from(`const { Pool }=require('pg'); const p=new Pool({connectionString:process.env.DATABASE_URL}); p.query("insert into public.gsa_tv_jobs(channel_id,job_type,status,progress,payload) values('ch-main','credentials_check','pending',0,'{}'::jsonb) returning id").then(r=>{console.log(r.rows[0].id);return p.end()}).catch(e=>{console.error(e.message);process.exit(1)});`).toString('base64');
const verify = Buffer.from(`const { Pool }=require('pg'); const p=new Pool({connectionString:process.env.DATABASE_URL}); p.query("select status,result,error_message from public.gsa_tv_jobs where job_type='credentials_check' order by created_at desc limit 1").then(r=>{console.log(JSON.stringify(r.rows[0]));return p.end()}).catch(e=>{console.error(e.message);process.exit(1)});`).toString('base64');
const remote = `set -euo pipefail
printf '%s' '${enqueue}' | base64 -d | sudo docker exec -i gsa-tv-control-plane node
sleep 7
printf '%s' '${verify}' | base64 -d | sudo docker exec -i gsa-tv-control-plane node
`;
const result = spawnSync('C:/Windows/System32/OpenSSH/ssh.exe', ['-o','BatchMode=yes','-o','ConnectTimeout=12','-i',key,'opc@147.15.43.141','bash','-s'], { input: remote, encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 });
if (result.status !== 0) { process.stderr.write(result.stderr || result.stdout || 'Falha no teste.'); process.exit(result.status || 1); }
process.stdout.write(result.stdout);
