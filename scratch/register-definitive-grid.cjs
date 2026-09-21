const fs=require('fs');
const root='/home/opc/gsa-ai';
const clock=JSON.parse(fs.readFileSync(`${root}/work/grade-definitiva-20260909-clock.json`,'utf8'));
if(clock.length!==27||clock[0].start!=='06:00'||clock.at(-1).end!=='23:59')throw Error('Relógio inválido');
const now=new Date();
const stamp=now.toISOString().replace(/[:.]/g,'-');
const currentDate=now.toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
const oldPath=`${root}/work/daily-automation-2026-09-09/grade-plan.json`;
const previous=JSON.parse(fs.readFileSync(oldPath,'utf8'));
const revision='definitiva-20260909-0600-2359';
if(previous.grid_revision!==revision){
 fs.copyFileSync(oldPath,`${oldPath}.bak-${stamp}`,fs.constants.COPYFILE_EXCL);
 const jobs=clock.map((c,index)=>{
  const old=previous.jobs?.find(j=>j.title===c.title)||{};
  return {order:index+1,program_id:c.program_id,title:c.title,slug:old.slug||null,
   scheduled_start:`${currentDate}T${c.start}:00-03:00`,scheduled_end:`${currentDate}T${c.end}:00-03:00`,
   slot_duration_s:c.slot_duration_s,content_mode:c.content_mode,production_mode:old.production_mode||c.content_mode,
   opening:old.opening||null,closing:old.closing||null,presenting_tts:old.presenting_tts||null,returning_tts:old.returning_tts||null,
   content_master:null,qc:'pending',publish:'pending',schedule:'editorial_slot_fixed_content_pending',metadata:c.metadata};
 });
 const plan={channel:'GSA TV',channel_id:'ch-main',date:currentDate,timezone:'America/Sao_Paulo',grid_revision:revision,
  window:'06:00-23:59',weekdays:[0,1,2,3,4,5,6],generated_from:'public.gsa_tv_weekly_grid_slots',
  canonical_video_target:'1920x1080/30 H.264 + AAC 48k stereo',
  production_window:{start:'00:00',end:'05:59',preflight:'05:59-06:00',status:'reserved_controller_not_validated'},
  broadcast_window:{start:'06:00',sign_off:'23:50',stop:'23:59'},
  notes:'Grade editorial definitiva. Não comprova masters prontos nem automação de produção/stop/start. Durações incluem vinhetas e intervalos. Abertura oficial 40s dentro do primeiro bloco. Não reutilizar o antigo News de uma hora.',jobs};
 fs.writeFileSync(oldPath,JSON.stringify(plan,null,2)+'\n');
 fs.writeFileSync(`${root}/work/grade-definitiva-20260909.json`,JSON.stringify({...plan,clock},null,2)+'\n');
}
const changelog=`${root}/GSA_TV_MEMORY_CHANGELOG.md`;
const marker='definitive-grid-applied-db-20260909-0600-2359';
if(!fs.readFileSync(changelog,'utf8').includes(marker)){
 fs.copyFileSync(changelog,`${changelog}.bak-grade-${stamp}`,fs.constants.COPYFILE_EXCL);
 const lines=clock.map(c=>`| ${c.start}–${c.end} | ${c.title} | ${c.slot_duration_s/60} min |`).join('\n');
 fs.appendFileSync(changelog,`\n## ${now.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})} BRT — Grade semanal definitiva aplicada no banco da VPS\n\n- Autorização expressa: aplicar e fixar a grade aprovada; produção reservada de 00h a 05h59. Filmes TODOS os dias, substituindo a sugestão temporária de somente fins de semana.\n- Mesma grade de segunda a domingo: 27 faixas/dia, 189 faixas semanais ativas, 64.740 segundos/dia (06h–23h59), sem lacunas/sobreposições e sem repetição de programa exceto Em Fé; News tem três programas/edições distintos. 25 programas editoriais preservados, mais bloco de continuidade/encerramento.\n- Grade semanal anterior não foi apagada em massa: faixas fora da nova grade desabilitadas; registros nas mesmas posições atualizados. Backup SQL: /home/opc/gsa-ai/work/grade-definitiva-backup-20260909-xKQGLH/grade-before.sql; função e política anterior também salvas nessa pasta.\n- 31 versões antigas da grade fixa foram canceladas preservando seus blocos/histórico; 31 versões editoriais novas publicadas de 09/09 a 09/10, com 27 blocos cada. Nenhuma versão running/completed foi modificada. Nenhum arquivo de mídia foi excluído.\n- Materializador atualizado para preservar metadados de abertura, tipo closing e proteção de corte do filme. Durações padrão dos 25 programas alinhadas, com sobreposição por faixa no Em Fé de 20min.\n- Política de horários salva em gsa_tv_channels.config.broadcast_schedule_policy: transmissão 06h, encerramento 23h50, stop 23h59, produção 00h–05h59, pré-flight 05h59–06h.\n- IMPORTANTE: a política é uma reserva/configuração editorial; o controlador automático de produção e liga/desliga NÃO foi implementado/validado nesta mudança. O compilador legado ainda contém preenchimento de 24h; precisa ser alinhado ao controlador antes de declarar rotina noturna operacional. Não houve chamada para reiniciar encoder ou publicar nova playlist nesta operação.\n- grade-plan.json da fila de 09/09 foi substituído com backup pelo novo relógio; entregas estão pending, não prontas. Plano consolidado: /home/opc/gsa-ai/work/grade-definitiva-20260909.json. Os programas antigos (inclusive News 60min) não são referência para novos slots.\n- Divergência visual encontrada: GsaTvScheduleTab.tsx continha lista fixa de 18 blocos/24h, botão que apenas mostrava sucesso e rótulo de no-ar inferido do relógio. Atualização visual tem publicação pendente: projeto do Sites associado retornou project_not_found. Não declarar a tela publicada.\n\n| Horário BRT | Programa | Duração da faixa |\n|---|---|---|\n${lines}\n\n- Identificador: ${marker}\n`);
}
console.log(JSON.stringify({revision,clock_entries:clock.length,plan:oldPath,changelog,verified:fs.readFileSync(changelog,'utf8').includes(marker)},null,2));
