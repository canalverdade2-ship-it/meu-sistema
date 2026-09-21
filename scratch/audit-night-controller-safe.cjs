const fs = require('fs');
const crypto = require('crypto');
const source = fs.readFileSync('/opt/gsa-tv/bin/gsa-tv-night-controller.sh', 'utf8');
const checks = {
  sha256: crypto.createHash('sha256').update(source).digest('hex'),
  compilePlaylist: source.includes('compile_playlist'),
  fixedSleep15: /sleep\s+15/.test(source),
  stopEndpoint: source.includes('/v1/stop'),
  ensureEndpoint: source.includes('/v1/ensure'),
  hasFlock: /\bflock\b/.test(source),
  hasFailOnHttp: /--fail|\s-f[\sS]/.test(source),
  hasStrictExit: /set\s+-[^\n]*e/.test(source),
  hasProductionReference: /render|production|produce|factory/.test(source),
  hasQcReference: /QC|qc|ffprobe/.test(source),
  hasTimeReference: /date\s|TZ=|America\/Sao_Paulo/.test(source),
};
console.log(JSON.stringify(checks));
const file='/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md';
const marker='night-controller-static-audit-20260909-1844';
const prior=fs.readFileSync(file,'utf8');
if(prior.includes(marker)) process.exit(0);
const now=new Date();
const backup=file+'.bak-controller-audit-'+now.toISOString().replace(/[:.]/g,'-');
const entry=`\n## ${now.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})} BRT — Auditoria estática do controlador noturno\n\n- Inspecionado /opt/gsa-tv/bin/gsa-tv-night-controller.sh sem executar suas ações. Resultados estáticos (não substituem teste integrado): ${JSON.stringify(checks)}.\n- O fluxo observado solicita compile_playlist, aguarda 15 segundos fixos e solicita ensure; isso não comprova conclusão do job nem conteúdo aprovado. Não considerar abertura validada por mensagem de sucesso do script.\n- A inspeção não demonstrou fábrica de programas ou QC integrados a este script. Outros componentes ainda precisam ser rastreados; ausência de referência neste arquivo não prova ausência no sistema inteiro.\n- Às 18h44 BRT: timers de encerramento/parada/abertura ainda sem última execução; disco 92%, 17GiB livres, load 6.24/5.79/5.73. Contêineres principais informaram healthy; control-plane com uptime de 55 minutos indica alteração externa recente, cuja versão deve ser reconciliada antes de modificar o controlador.\n- Nenhum start/stop/ensure, render pesado ou mudança de qualidade executado nesta auditoria. Nenhuma credencial reproduzida neste registro.\n- Pendência concreta: validar retorno HTTP, conclusão assíncrona, guardas de horário/concorrência e conexão com produção/QC antes de confiar no primeiro ciclo automático.\n- Identificador: ${marker}\n`;
fs.copyFileSync(file,backup,fs.constants.COPYFILE_EXCL);
fs.appendFileSync(file,entry);
if(!fs.readFileSync(file,'utf8').endsWith(entry))throw Error('Falha de verificação');
console.log(JSON.stringify({registered:true,backup}));
