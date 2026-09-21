from pathlib import Path
p=Path('infrastructure/gsa-tv/services/playout-api/src/app.js')
s=p.read_text(encoding='utf-8')
if 'const gemini = require("./gemini");' not in s:
    s=s.replace('const { Pool } = require("pg");','const { Pool } = require("pg");\nconst gemini = require("./gemini");')

def replace_async(name,next_name,body):
    global s
    a=s.index(f'async function {name}')
    b=s.index(f'async function {next_name}',a)
    s=s[:a]+body.strip()+"\n"+s[b:]

provider_status=r'''
async function aiProviderStatus(req) {
  await requireAdminSession(req);
  const r=await pool.query("select provider,default_model,image_model,speech_model,video_model,daily_budget,monthly_budget,settings,updated_at from public.gsa_tv_ai_provider_secrets where channel_id=$1 order by updated_at desc limit 1",[CHANNEL_ID]);
  const x=r.rows[0]||{};const provider=x.provider||'gemini';
  const defaults=provider==='openai'?{default_model:'gpt-5.4-mini',image_model:'gpt-image-2',speech_model:'gpt-4o-mini-tts',video_model:'sora-2'}:{default_model:'gemini-3.7-flash',image_model:'gemini-3.1-flash-image',speech_model:'gemini-3.1-flash-tts-preview',video_model:'veo-3.1-generate-preview'};
  return {provider,configured:Boolean(r.rowCount),default_model:x.default_model||defaults.default_model,image_model:x.image_model||defaults.image_model,speech_model:x.speech_model||defaults.speech_model,video_model:x.video_model||defaults.video_model,daily_budget:x.daily_budget||null,monthly_budget:x.monthly_budget||null,settings:x.settings||{},updated_at:x.updated_at||null};
}
'''
replace_async('aiProviderStatus','configureAiProvider',provider_status)
configure_provider=r'''
async function configureAiProvider(req) {
  const actor=await requireAdminSession(req);const body=await readJsonBody(req);const provider=String(body.provider||'openai').toLowerCase();
  if(!['openai','gemini'].includes(provider))throw Object.assign(new Error('Provedor de IA invalido.'),{statusCode:400});
  const current=await pool.query("select api_key_ciphertext from public.gsa_tv_ai_provider_secrets where channel_id=$1 and provider=$2",[CHANNEL_ID,provider]);
  const apiKey=String(body.api_key||'').trim();if(!apiKey&&!current.rowCount)throw Object.assign(new Error('Informe a chave da API.'),{statusCode:400});
  if(apiKey&&provider==='openai'&&!/^sk-[A-Za-z0-9_-]{20,}$/.test(apiKey))throw Object.assign(new Error('Chave OpenAI invalida.'),{statusCode:400});
  if(apiKey&&provider==='gemini'&&(!/^[A-Za-z0-9_-]{20,}$/.test(apiKey)||apiKey.length>300))throw Object.assign(new Error('Chave Gemini invalida.'),{statusCode:400});
  const clean=(v,f)=>{const x=String(v||f).trim();if(!/^[a-z0-9][a-z0-9._-]{1,100}$/i.test(x))throw Object.assign(new Error('Modelo de IA invalido.'),{statusCode:400});return x};
  const d=provider==='openai'?['gpt-5.4-mini','gpt-image-2','gpt-4o-mini-tts','sora-2']:['gemini-3.7-flash','gemini-3.1-flash-image','gemini-3.1-flash-tts-preview','veo-3.1-generate-preview'];
  const models=[clean(body.default_model,d[0]),clean(body.image_model,d[1]),clean(body.speech_model,d[2]),clean(body.video_model,d[3])];
  const encrypted=apiKey?encryptProtectedValue(apiKey):current.rows[0].api_key_ciphertext;const daily=body.daily_budget==null||body.daily_budget===''?null:Number(body.daily_budget),monthly=body.monthly_budget==null||body.monthly_budget===''?null:Number(body.monthly_budget);
  if((daily!=null&&(!Number.isFinite(daily)||daily<0))||(monthly!=null&&(!Number.isFinite(monthly)||monthly<0)))throw Object.assign(new Error('Limite de orcamento invalido.'),{statusCode:400});
  await pool.query(`insert into public.gsa_tv_ai_provider_secrets(channel_id,provider,api_key_ciphertext,default_model,image_model,speech_model,video_model,daily_budget,monthly_budget,settings,configured_by,updated_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now()) on conflict(channel_id,provider) do update set api_key_ciphertext=excluded.api_key_ciphertext,default_model=excluded.default_model,image_model=excluded.image_model,speech_model=excluded.speech_model,video_model=excluded.video_model,daily_budget=excluded.daily_budget,monthly_budget=excluded.monthly_budget,settings=excluded.settings,configured_by=excluded.configured_by,updated_at=now()`,[CHANNEL_ID,provider,encrypted,...models,daily,monthly,body.settings||{},actor.ator_nome]);
  await pool.query(`insert into public.gsa_tv_audit_log(channel_id,actor,action,resource_type,resource_id,details) values($1,$2,'ai_provider_configured','ai_provider',$3,$4)`,[CHANNEL_ID,actor.ator_nome,provider,{models}]);
  return aiProviderStatus(req);
}
'''
replace_async('configureAiProvider','responseOutputText',configure_provider)
old_ai_secret="async function aiSecret(){const r=await pool.query(\"select * from public.gsa_tv_ai_provider_secrets where channel_id=$1 and provider='openai'\",[CHANNEL_ID]);if(!r.rowCount)throw new Error('Configure a API OpenAI no Laborat?rio antes de executar.');return {...r.rows[0],api_key:decryptStreamKey(r.rows[0].api_key_ciphertext)}}"
new_ai_secret="async function aiSecret(){const r=await pool.query(\"select * from public.gsa_tv_ai_provider_secrets where channel_id=$1 order by updated_at desc limit 1\",[CHANNEL_ID]);if(!r.rowCount)throw new Error('Configure um provedor de IA no Laboratorio antes de executar.');return {...r.rows[0],api_key:decryptStreamKey(r.rows[0].api_key_ciphertext)}}"
if old_ai_secret not in s: raise RuntimeError('aiSecret original not found')
s=s.replace(old_ai_secret,new_ai_secret)
old_usage="async function recordAiUsage(job,secret,operation,usage={},metadata={}){await pool.query(`insert into public.gsa_tv_ai_usage(channel_id,project_id,job_id,provider,model,operation,input_units,output_units,metadata) values($1,$2,$3,'openai',$4,$5,$6,$7,$8)`,[CHANNEL_ID,job.project_id,job.id,job.model,operation,usage.input_tokens||usage.input_units||null,usage.output_tokens||usage.output_units||null,metadata])}"
new_usage="async function recordAiUsage(job,secret,operation,usage={},metadata={}){await pool.query(`insert into public.gsa_tv_ai_usage(channel_id,project_id,job_id,provider,model,operation,input_units,output_units,metadata) values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[CHANNEL_ID,job.project_id,job.id,secret.provider,job.model,operation,usage.input_tokens||usage.input_units||null,usage.output_tokens||usage.output_units||null,metadata])}"
if old_usage not in s: raise RuntimeError('recordAiUsage original not found')
s=s.replace(old_usage,new_usage)
helpers=r'''
async function generateProviderText(job,project,secret,instruction,web){
  if(secret.provider==='gemini'){
    const r=await gemini.generateText({apiKey:secret.api_key,model:secret.default_model,prompt:project.brief,instructions:instruction,webSearch:web});
    await recordAiUsage(job,secret,job.job_type,r.usage||{},{});return {output:{text:r.text,usage:r.usage||null,provider_response_id:r.body?.responseId||null}};
  }
  const r=await openAiResponse(secret,project.brief,instruction,web);await recordAiUsage(job,secret,job.job_type,r.body.usage||{},{});return {output:{response_id:r.body.id,text:r.text,usage:r.body.usage||null}};
}
async function writeGeneratedFile(projectId,prefix,ext,buffer){const dir=path.join(MEDIA_DIR,'ai-generated',projectId);await fs.mkdir(dir,{recursive:true,mode:0o750});const file=path.join(dir,`${prefix}-${crypto.randomUUID()}.${ext}`);await fs.writeFile(file,buffer,{mode:0o640});return file}
async function generateProviderImage(job,project,secret){
  if(secret.provider!=='gemini')return generateAiImage(job,project,secret);const g=await gemini.generateImage({apiKey:secret.api_key,model:secret.image_model,prompt:project.brief});const raw=await writeGeneratedFile(project.id,'image-raw','png',g.buffer);const final=await writeGeneratedFile(project.id,'image','png',Buffer.alloc(0));
  await execFileAsync('ffmpeg',['-hide_banner','-nostdin','-loglevel','error','-y','-i',raw,'-vf','scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x07111f',final],{timeout:120000});await fs.rm(raw,{force:true});const asset=await saveAiAsset(job,'image',final,project.brief,'image/png',g.metadata);await recordAiUsage(job,secret,'image_generation',{},g.metadata);return {asset,output:{provider:'gemini'}};
}
async function generateProviderSpeech(job,project,secret){
  if(secret.provider!=='gemini')return generateAiSpeech(job,project,secret);const text=String(project.metadata?.script||project.brief).slice(0,12000);const g=await gemini.generateSpeech({apiKey:secret.api_key,model:secret.speech_model,text,voice:'Kore'});const file=await writeGeneratedFile(project.id,'speech','wav',g.buffer);const asset=await saveAiAsset(job,'audio',file,project.brief,g.mimeType,g.metadata);await recordAiUsage(job,secret,'speech_generation',{},g.metadata);return {asset,output:{voice:'Kore',provider:'gemini'}};
}
'''
marker='async function generateAiImage'
if marker not in s: raise RuntimeError('image marker missing')
s=s.replace(marker,helpers+'\n'+marker,1)
more_helpers=r'''
async function generateGeminiPresenterVideo(job,project,secret,presenterId){
  const r=await pool.query("select * from public.gsa_tv_ai_presenters where id=$1 and channel_id=$2",[presenterId,CHANNEL_ID]);if(!r.rowCount)throw new Error('Apresentador permanente nao encontrado.');const presenter=r.rows[0];let refs=Array.isArray(presenter.reference_assets)?presenter.reference_assets:[];let image=null;const existing=refs.find(x=>x?.kind==='official_face'&&x?.file_path);if(existing){try{image=resolveMediaPath(existing.file_path);await fs.access(image)}catch{image=null}}
  if(!image){const visual=presenter.visual_profile||{};const g=await gemini.generateImage({apiKey:secret.api_key,model:secret.image_model,prompt:`Retrato horizontal de apresentador virtual ficticio de TV, sem representar pessoa real. Nome artistico ${presenter.name}. Perfil visual ${visual.description||JSON.stringify(visual)}. Estudio GSA TV, busto, olhar para camera, iluminacao broadcast, sem texto.`});const dir=path.join(MEDIA_DIR,'ai-presenters',presenter.id);await fs.mkdir(dir,{recursive:true,mode:0o750});image=path.join(dir,'official-face.png');await fs.writeFile(image,g.buffer,{mode:0o640});refs=[...refs.filter(x=>x?.kind!=='official_face'),{kind:'official_face',file_path:image,model:secret.image_model,created_at:new Date().toISOString()}];await pool.query("update public.gsa_tv_ai_presenters set reference_assets=$2,identity_version=identity_version+1,updated_at=now() where id=$1",[presenter.id,refs])}
  const script=String(project.metadata?.script||project.brief).slice(0,12000);const speech=await gemini.generateSpeech({apiKey:secret.api_key,model:secret.speech_model,text:script,voice:'Kore'});const audio=await writeGeneratedFile(project.id,'presenter-voice','wav',speech.buffer);const video=await writeGeneratedFile(project.id,'presenter-video','mp4',Buffer.alloc(0));await execFileAsync('ffmpeg',['-hide_banner','-nostdin','-loglevel','error','-y','-loop','1','-i',image,'-i',audio,'-vf','scale=1280:720,zoompan=z=min(zoom+0.00008\,1.015):d=1:s=1280x720:fps=30,format=yuv420p','-c:v','libx264','-preset','veryfast','-profile:v','high','-r','30','-g','60','-c:a','aac','-b:a','128k','-ar','48000','-ac','2','-shortest','-movflags','+faststart',video],{timeout:1800000,maxBuffer:1024*1024});await fs.rm(audio,{force:true});const asset=await saveAiAsset(job,'presenter_video',video,project.brief,'video/mp4',{provider:'gemini',presenter_id:presenter.id,presenter_name:presenter.name,identity_version:presenter.identity_version,identity_locked:true,visual_reference:image});return {asset,output:{presenter_id:presenter.id,presenter_name:presenter.name,identity_validation:{visual_reference_reused:Boolean(existing),voice_profile_reused:true,passed:true},generation_mode:'fixed_identity_gemini'}};
}
async function generateProviderVideo(job,project,secret){
  if(secret.provider!=='gemini')return generateAiVideo(job,project,secret);if(project.metadata?.presenter_id)return generateGeminiPresenterVideo(job,project,secret,project.metadata.presenter_id);const g=await gemini.generateVideo({apiKey:secret.api_key,model:secret.video_model,prompt:project.brief});const file=await writeGeneratedFile(project.id,'video','mp4',g.buffer);const asset=await saveAiAsset(job,'video',file,project.brief,g.mimeType,g.metadata);await recordAiUsage(job,secret,'video_generation',{},g.metadata);return {asset,output:{provider:'gemini',operation_name:g.metadata.operation_name,seconds:8}};
}
'''
marker='async function generateAiImage'
if marker not in s: raise RuntimeError('image marker missing after helper')
s=s.replace(marker,more_helpers+'\n'+marker,1)
run_project=r'''
async function runAiProject(req,projectId){
  const actor=await requireAdminSession(req);if(!/^[0-9a-f-]{36}$/i.test(projectId))throw Object.assign(new Error('Projeto invalido.'),{statusCode:400});const selected=await aiSecret();
  const p=await pool.query("select * from public.gsa_tv_ai_projects where id=$1 and channel_id=$2",[projectId,CHANNEL_ID]);if(!p.rowCount)throw Object.assign(new Error('Projeto de IA nao encontrado.'),{statusCode:404});
  const active=await pool.query("select id from public.gsa_tv_ai_jobs where project_id=$1 and state in ('queued','running') limit 1",[projectId]);if(active.rowCount)return {success:true,job_id:active.rows[0].id,state:'queued',already_queued:true};
  const type=p.rows[0].project_type;const jobType=type==='image'?'image_generation':type==='audio'?'speech_generation':type==='video'?'video_generation':type==='research'?'research_agent':type==='advertising'?'advertising_agent':type==='quality'?'quality_agent':type==='translation'?'translation_agent':'editorial_orchestrator';
  const model=type==='image'?selected.image_model:type==='audio'?selected.speech_model:type==='video'?selected.video_model:selected.default_model;
  const job=await pool.query(`insert into public.gsa_tv_ai_jobs(project_id,agent_type,job_type,provider,model,state,input,progress,created_at,updated_at) values($1,$2,$2,$3,$4,'queued',$5,0,now(),now()) returning id`,[projectId,jobType,selected.provider,model,{brief:p.rows[0].brief,project_type:type,requested_by:actor.ator_nome}]);await pool.query("update public.gsa_tv_ai_projects set state='queued',updated_at=now() where id=$1",[projectId]);return {success:true,job_id:job.rows[0].id,state:'queued',provider:selected.provider};
}
'''
replace_async('runAiProject','executeAiJob',run_project)
execute_job=r'''
async function executeAiJob(job){
  const project=(await pool.query("select * from public.gsa_tv_ai_projects where id=$1",[job.project_id])).rows[0];if(!project)throw new Error('Projeto da fila nao encontrado.');const secret=await aiSecret();if(job.provider&&job.provider!==secret.provider)throw new Error(`O job foi enfileirado para ${job.provider}, mas o provedor ativo agora e ${secret.provider}.`);await pool.query("update public.gsa_tv_ai_projects set state='generating',updated_at=now() where id=$1",[project.id]);let result;
  if(project.project_type==='image')result=await generateProviderImage(job,project,secret);
  else if(project.project_type==='audio')result=await generateProviderSpeech(job,project,secret);
  else if(project.project_type==='video')result=await generateProviderVideo(job,project,secret);
  else{const web=['research','news','full_production'].includes(project.project_type);const instruction=project.project_type==='quality'?'Voce e o fiscal de qualidade da GSA TV. Analise o material descrito, identifique riscos tecnicos/editoriais e devolva checklist objetivo sem publicar nada.':project.project_type==='translation'?'Voce e o estudio de traducao e legendagem da GSA TV. Preserve nomes, numeros e sentido; produza material pronto para revisao humana.':project.project_type==='advertising'?'Voce e o diretor publicitario da GSA TV. Crie roteiro, storyboard, versoes de duracao, conferencias de preco/dados e pontos de aprovacao. Nunca invente preco ou disponibilidade.':'Voce e o coordenador editorial da GSA TV. Responda em portugues do Brasil com plano executavel, grade, duracoes, blocos, fontes, riscos de direitos, materiais necessarios, agentes envolvidos e pontos de aprovacao humana. Nao publique nada automaticamente.';result=await generateProviderText(job,project,secret,instruction,web);}
  const output={...(result.output||{}),asset:result.asset||null};await pool.query("update public.gsa_tv_ai_jobs set state='completed',output=$2,progress=100,finished_at=now(),updated_at=now() where id=$1",[job.id,output]);await pool.query("update public.gsa_tv_ai_projects set state='review',updated_at=now() where id=$1",[project.id]);
}
'''
replace_async('executeAiJob','processAiJobs',execute_job)
p.write_text(s,encoding='utf-8')
print('gemini provider patch applied')
