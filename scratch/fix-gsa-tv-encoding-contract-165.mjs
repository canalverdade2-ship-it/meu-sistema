import fs from 'node:fs';
const patch=(f,repls)=>{let s=fs.readFileSync(f,'utf8');for(const [a,b] of repls){if(!s.includes(a))console.log('missing',f,a);s=s.split(a).join(b);}fs.writeFileSync(f,s)};
patch('src/components/admin/GsaTvModule.tsx',[["'Opera??es'","'Opera\u00e7\u00f5es'"]]);
patch('infrastructure/gsa-tv/services/playout-api/src/app.js',[
['Grava??o ao vivo','Grava\u00e7\u00e3o ao vivo'],['Nome art?stico','Nome art\u00edstico'],['Est?dio','Est\u00fadio'],['c?mera','c\u00e2mera'],['ilumina??o','ilumina\u00e7\u00e3o'],['Cria??o IA','Cria\u00e7\u00e3o IA'],['m?dia sem direitos v?lidos','m\u00eddia sem direitos v\u00e1lidos']
]);
patch('infrastructure/gsa-tv/services/watchdog/src/app.js',[["Sem t?tulo","Sem t\u00edtulo"],["n?o configurado","n\u00e3o configurado"]]);
let t=fs.readFileSync('scripts/check-gsa-tv-contracts.ts','utf8');t=t.split("label: 'Opera??es'").join("label: 'Opera\u00e7\u00f5es'").split("'Opera??es'").join("'Opera\u00e7\u00f5es'");
t=t.replace('["workflow n8n 07 produz somente projetos aprovados para autonomia", n8nWorkflowText.includes("Approved Autonomous Projects") && n8nWorkflowText.includes("ai_ready")],','["workflow n8n 07 produz somente projetos aprovados para autonomia", n8nWorkflowText.includes("Approved Autonomous Projects") && n8nWorkflowText.includes("ai_ready")],\n  ["backend exige autonomia aprovada para IA via n8n", control.includes("requireAutonomy") && control.includes("supervised_auto") && control.includes("authorized_routine") && control.includes("Projeto não autorizado para execução automática")],\n  ["automacao n8n nao pode reiniciar playout nem validar credenciais", !/AUTOMATION_JOB_TYPES[^;]+playout_reload/s.test(control) && !/AUTOMATION_JOB_TYPES[^;]+credentials_check/s.test(control) && !/AUTOMATION_JOB_TYPES[^;]+relay_check/s.test(control)],');
fs.writeFileSync('scripts/check-gsa-tv-contracts.ts',t);
