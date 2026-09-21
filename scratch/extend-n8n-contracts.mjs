import fs from 'node:fs';
const p='scripts/check-gsa-tv-contracts.ts';
let s=fs.readFileSync(p,'utf8');
const anchor='const n8nWorkflowText = n8nWorkflows.join("\\n");';
const vars=`${anchor}
const n8nWorkflowJsons = n8nWorkflows.map((x) => JSON.parse(x));
const n8nCompose = read("infrastructure/gsa-tv/n8n/docker-compose.yml");
const n8nNginx = read("infrastructure/gsa-tv/n8n/nginx-n8n.conf");
const n8nImporter = read("infrastructure/gsa-tv/n8n/import-workflows.sh");
const n8nConnectionsValid = n8nWorkflowJsons.every((w: any) => {
  const names = new Set((w.nodes || []).map((n: any) => n.name));
  return Object.entries(w.connections || {}).every(([from, outputs]: any) =>
    names.has(from) && (outputs.main || []).flat().every((edge: any) => names.has(edge.node)));
});
const n8nTestTriggersValid = n8nWorkflowJsons.every((w: any) =>
  (w.nodes || []).some((n: any) => n.type === "n8n-nodes-base.scheduleTrigger") &&
  (w.nodes || []).some((n: any) => n.type === "n8n-nodes-base.executeWorkflowTrigger"));`;
if(!s.includes(anchor)) throw new Error('n8n vars anchor missing');
s=s.replace(anchor,vars);
const end='  ["automacao n8n nao pode reiniciar playout nem validar credenciais", !/AUTOMATION_JOB_TYPES[^;]+playout_reload/s.test(control) && !/AUTOMATION_JOB_TYPES[^;]+credentials_check/s.test(control) && !/AUTOMATION_JOB_TYPES[^;]+relay_check/s.test(control)],';
const extra=`${end}
  ["workflows n8n possuem gatilho de homologacao e conexoes validas", n8nTestTriggersValid && n8nConnectionsValid],
  ["runtime n8n publica somente loopback e usa env root-only externo", n8nCompose.includes('127.0.0.1:5678:5678') && n8nCompose.includes('/etc/gsa/n8n.env') && !/PASSWORD\s*[:=]\s*[^$\s]/i.test(n8nCompose)],
  ["proxy n8n termina TLS e encaminha apenas para loopback", n8nNginx.includes('listen 443 ssl') && n8nNginx.includes('proxy_pass http://127.0.0.1:5678')],
  ["importador n8n atualiza ID estavel e publica nova versao", n8nImporter.includes('n8n import:workflow') && n8nImporter.includes('n8n publish:workflow') && !n8nImporter.includes('skip|')],`;
if(!s.includes(end)) throw new Error('checks anchor missing');
s=s.replace(end,extra);
fs.writeFileSync(p,s);
console.log('n8n hardening contracts added');
