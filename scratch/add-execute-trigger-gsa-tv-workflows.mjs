import fs from 'node:fs';
import path from 'node:path';
const dir='infrastructure/gsa-tv/n8n/workflows';
for(const file of fs.readdirSync(dir).filter(x=>x.endsWith('.json')).sort()){
  const p=path.join(dir,file); const w=JSON.parse(fs.readFileSync(p,'utf8'));
  w.nodes=w.nodes.filter(n=>n.id!=='exec-trigger');
  const schedule=w.nodes.find(n=>n.type==='n8n-nodes-base.scheduleTrigger');
  if(!schedule) throw new Error(`${file}: schedule trigger missing`);
  const first=((w.connections[schedule.name]||{}).main||[])[0]?.[0]?.node;
  if(!first) throw new Error(`${file}: first target missing`);
  const pos=Array.isArray(schedule.position)?schedule.position:[240,300];
  const exec={id:'exec-trigger',name:'Execute - Test or Reuse',type:'n8n-nodes-base.executeWorkflowTrigger',typeVersion:1.2,position:[pos[0],pos[1]+140],parameters:{inputSource:'passthrough'}};
  w.nodes.splice(1,0,exec);
  w.connections[exec.name]={main:[[{node:first,type:'main',index:0}]]};
  fs.writeFileSync(p,JSON.stringify(w,null,2)+'\n');
  console.log(`patched|${file}|${first}`);
}
