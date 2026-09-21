// Run inside the existing n8n container. Credentials stay in process memory.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/usr/local/lib/node_modules/n8n/package.json');
const { Pool } = require('pg');
const e = process.env;
const pool = new Pool({host:e.DB_POSTGRESDB_HOST,port:e.DB_POSTGRESDB_PORT,user:e.DB_POSTGRESDB_USER,password:e.DB_POSTGRESDB_PASSWORD,database:e.DB_POSTGRESDB_DATABASE});
const ids = ['gsaTvAiProduction07','gsaTvScheduleCompile02'];
const backup = '/tmp/gsa-tv-n8n-production-backup-20260914.json';
try {
  let key;
  const keys=await pool.query('select "apiKey" from user_api_keys where audience=$1',['public-api']);
  for(const row of keys.rows){
    const response=await fetch(`http://127.0.0.1:5678/api/v1/workflows/${ids[0]}`,{headers:{'X-N8N-API-KEY':row.apiKey}});
    if(response.ok){key=row.apiKey;break;}
  }
  if(!key)throw new Error('API autenticada do n8n indisponível');
  async function api(path,method='GET',body){
    const r=await fetch('http://127.0.0.1:5678/api/v1'+path,{method,headers:{'X-N8N-API-KEY':key,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
    if(!r.ok)throw new Error(`n8n ${method}: HTTP ${r.status}`);
    return r.json();
  }
  if(process.argv[2]==='backup'){
    if(fs.existsSync(backup))throw new Error('Backup já existe; não sobrescrever');
    const workflows=[];
    for(const id of ids)workflows.push(await api('/workflows/'+id));
    fs.writeFileSync(backup,JSON.stringify(workflows),{mode:0o600});
    console.log('N8N_BACKUP_CREATED');
  }else if(process.argv[2]==='apply'){
    const workflows=JSON.parse(fs.readFileSync(backup,'utf8'));
    const original=workflows.find(w=>w.id===ids[0]);
    const edited=structuredClone(original);
    edited.nodes.find(n=>n.id==='s7').parameters.rule={interval:[{field:'cronExpression',expression:'*/10 0-4 * * *'}]};
    const guard="const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',hourCycle:'h23'}).format(new Date())); if(hour>=5)return [];\n";
    edited.nodes.find(n=>n.id==='c7').parameters.jsCode=guard+original.nodes.find(n=>n.id==='c7').parameters.jsCode;
    edited.settings={...edited.settings,timezone:'America/Sao_Paulo'};
    await api('/workflows/'+ids[0]+'/deactivate','POST');
    try{
      await api('/workflows/'+ids[0],'PUT',{name:edited.name,nodes:edited.nodes,connections:edited.connections,settings:edited.settings});
      if(original.active)await api('/workflows/'+ids[0]+'/activate','POST');
    }catch(error){
      await api('/workflows/'+ids[0],'PUT',{name:original.name,nodes:original.nodes,connections:original.connections,settings:original.settings});
      if(original.active)await api('/workflows/'+ids[0]+'/activate','POST');
      throw error;
    }
    // Compilation now belongs to verified completion and the morning controller.
    await api('/workflows/'+ids[1]+'/deactivate','POST');
    for(const id of ids){const w=await api('/workflows/'+id);console.log(JSON.stringify({id,active:w.active,schedules:w.nodes.filter(n=>n.type.includes('scheduleTrigger')).map(n=>n.parameters.rule)}));}
  }else throw new Error('Use backup ou apply');
}catch(error){console.error(error.message);process.exitCode=1;}finally{await pool.end();}
