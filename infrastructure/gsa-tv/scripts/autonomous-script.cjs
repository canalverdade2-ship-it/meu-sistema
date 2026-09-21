#!/usr/bin/env node
// Run inside the Control Plane container. Vault credentials never leave this process.
const fs=require('node:fs/promises');
const crypto=require('node:crypto');
const {Pool}=require('/app/node_modules/pg');
const gemini=require('/app/src/gemini.js');
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
const words=text=>text.trim().split(/\s+/u).filter(Boolean).length;
const parse=text=>JSON.parse(text.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));

async function main(){
 let input='';for await(const chunk of process.stdin)input+=chunk;
 const task=JSON.parse(input);
 if(!/^\/media\/1\/production\/autonomous\//.test(task.output)||task.output.includes('..'))throw Error('Destino inválido');
 if(task.mode!=='original_reflection'&&task.mode!=='generic_program')throw Error('Formato ainda não habilitado neste gerador');
 if(!Number.isInteger(task.targetWords)||task.targetWords<500||task.targetWords>10000)throw Error('Orçamento inválido');
 const pool=new Pool({connectionString:process.env.DATABASE_URL});
 try{
  const row=(await pool.query("select * from gsa_tv_ai_provider_secrets where channel_id='ch-main' order by updated_at desc limit 1")).rows[0];
  if(!row||row.provider!=='gemini')throw Error('Provedor Gemini configurado necessário');
  const [version,ivPart,bodyPart]=row.api_key_ciphertext.split('.');
  if(version!=='v1')throw Error('Formato de credencial inválido');
  const encrypted=Buffer.from(bodyPart,'base64url');
  const decipher=crypto.createDecipheriv('aes-256-gcm',Buffer.from(process.env.GSA_TV_SECRET_KEY,'hex'),Buffer.from(ivPart,'base64url'));
  decipher.setAuthTag(encrypted.subarray(-16));
  const apiKey=Buffer.concat([decipher.update(encrypted.subarray(0,-16)),decipher.final()]).toString('utf8');
  async function generate(prompt,instructions,operation,maxOutputTokens=5000){
   const result=await gemini.generateText({apiKey,model:row.default_model,prompt,instructions,webSearch:false,temperature:operation==='review'?0:0.45,thinkingBudget:0,maxOutputTokens});
   await pool.query("insert into gsa_tv_ai_usage(channel_id,provider,model,operation,input_units,output_units,metadata) values('ch-main',$1,$2,$3,$4,$5,$6::jsonb)",[row.provider,row.default_model,operation,result.usage?.input_tokens??null,result.usage?.output_tokens??null,JSON.stringify({pipeline:'autonomous-script',broadcast_date:task.date,program:task.program})]);
   return result.text;
  }
  const themes=['acolher sem julgar','paciência nas pequenas atitudes','cuidar dos vínculos','gratidão sem negar as dificuldades','recomeçar com responsabilidade','escuta e solidariedade'];
  const count=Math.ceil(task.targetWords/500);const target=Math.ceil(task.targetWords/count);
  const parentDir=require('node:path').dirname(task.output);
  const baseName=require('node:path').basename(task.output);
  await fs.mkdir(parentDir,{recursive:true});

  let result;
  try {
    const raw = await fs.readFile(task.output, 'utf8');
    const existing = JSON.parse(raw);
    if (existing && existing.script_sha256 && existing.review?.pass === true && Array.isArray(existing.sections) && existing.sections.length === count && existing.mode === task.mode) {
      result = existing;
      console.error('SCRIPT_ALREADY_VALIDATED words: ' + result.word_count + ' hash: ' + result.script_sha256);
    }
  } catch {}

  if (!result) {
    const sections=[];
    for(let index=0;index<count;index++){
      let section = null;
      try {
        const files = (await fs.readdir(parentDir)).filter(f => f.startsWith(`${baseName}.part-${index+1}-`)).sort();
        for (const f of files.reverse()) {
          try {
            const saved = JSON.parse(await fs.readFile(parentDir + '/' + f, 'utf8'));
            if (typeof saved?.text === 'string' && typeof saved?.title === 'string' && saved?.mode === task.mode) {
              const w = words(saved.text);
              if (w >= target * 0.83 && w <= target * 1.17) {
                section = saved;
                console.error(`SCRIPT_CHECKPOINT_REUSED ${(index+1)}/${count} (${w} words) from ${f}`);
                break;
              }
            }
          } catch {}
        }
      } catch {}

      if (!section) {
        const instructions = task.mode === 'generic_program'
          ? `Escreva um texto ORIGINAL em português brasileiro para locução do programa televisivo "${task.program}". O texto deve ser apropriado para o tema e formato deste programa. Não copie textos protegidos. Não cite pessoas reais, estatísticas, estudos, fatos atuais ou testemunhos como reais. Não prometa cura, prosperidade ou intervenção divina. Exemplos devem ser claramente hipotéticos. Não dê conselho médico/financeiro. Sem propaganda, pedidos de dinheiro, participação ao vivo ou contatos inventados. Não inclua instruções de direção no texto falado. Desenvolva ideias distintas, sem enchimento e sem repetir parágrafos. IMPORTANTE: Desenvolva o texto com extensão entre ${Math.floor(target*0.88)} e ${Math.ceil(target*1.12)} palavras (mínimo de ${Math.floor(target*0.88)} palavras). Responda somente JSON com title (curto), text (locução integral), visual_query (termo de busca curto em inglês de 1 a 3 palavras para banco de imagens para ilustrar este parágrafo).`
          : 'Escreva um texto ORIGINAL em português brasileiro para locução de um programa de reflexão cristã acolhedora. Não copie orações, músicas ou traduções bíblicas. Não cite versículos, pessoas reais, estatísticas, estudos, fatos atuais ou testemunhos como reais. Não prometa cura, prosperidade ou intervenção divina garantida. Exemplos devem ser claramente hipotéticos. Não dê conselho médico/financeiro. Sem propaganda, pedidos de dinheiro, participação ao vivo ou contatos inventados. Não inclua instruções de direção no texto falado. Desenvolva ideias distintas, sem enchimento e sem repetir parágrafos. IMPORTANTE: Desenvolva o texto com extensão entre ' + Math.floor(target*0.88) + ' e ' + Math.ceil(target*1.12) + ' palavras (mínimo de ' + Math.floor(target*0.88) + ' palavras). Responda somente JSON com title (curto), text (locução integral), visual_query (termo de busca curto em inglês de 1 a 3 palavras para banco de imagens para ilustrar este parágrafo).';
        for(let attempt=0;attempt<3;attempt++){
          try {
            const currentTheme = task.mode === 'generic_program' ? 'conteúdo apropriado ao programa' : themes[(index+Number(task.date.slice(-2)))%themes.length];
            await new Promise(r => setTimeout(r, 3500)); // Pace globally to ~17 req/min
            section=parse(await generate(JSON.stringify({program:task.program,date:task.date,part:index+1,totalParts:count,theme:currentTheme,targetWords:target,minimumWords:Math.floor(target*0.90),maximumWords:Math.ceil(target*1.10),opening:index===0,closing:index===count-1,previousTopics:sections.map(x=>x.title),previousAttemptWords:section?words(section.text):null}),instructions,'broadcast_script'));
            section.mode = task.mode;
            await fs.writeFile(task.output+`.part-${index+1}-attempt-${attempt+1}-${Date.now()}.json`,JSON.stringify(section,null,2),{mode:0o640,flag:'wx'});
            console.error('SCRIPT_WORD_COUNT '+(index+1)+' '+words(section.text||''));
            if(typeof section.text==='string'&&typeof section.title==='string'&&words(section.text)>=target*0.83&&words(section.text)<=target*1.17)break;
          } catch (e) {
            console.error('SCRIPT_GENERATION_ERROR', e.message);
            let waitTime = 5000;
            const match = e.message.match(/retry in ([\d\.]+)s/i);
            if (match) waitTime = Math.ceil(parseFloat(match[1]) * 1000) + 2000;
            await new Promise(r => setTimeout(r, waitTime));
          }
        }
      }
      if(!section||typeof section.text!=='string'||words(section.text)<target*0.83||words(section.text)>target*1.17)throw Error('Roteiro fora do orçamento na parte '+(index+1));
      sections.push(section);
      console.error('SCRIPT_SECTION_READY '+(index+1)+'/'+count);
    }
    const narration=sections.map(x=>x.text.trim()).join('\n\n');
    const reviewInstructions = task.mode === 'generic_program'
      ? `Você é o revisor editorial do programa "${task.program}". Avalie se o texto é original, coerente com o programa, sem instruções de produção faladas, repetição excessiva, fatos externos sem fonte, testemunhos apresentados como reais, promessas absurdas ou contatos inventados. Responda apenas JSON {"pass":boolean,"violations":[string]}. Reprove qualquer violação substancial.`
      : 'Você é o revisor editorial. Avalie se o texto é uma reflexão original coerente, sem instruções de produção faladas, repetição excessiva, fatos externos sem fonte, testemunhos apresentados como reais, citações de músicas/orações/versículos, promessas garantidas de cura/dinheiro/milagres ou contatos inventados. Não exija fontes para crenças religiosas claramente apresentadas como reflexão. Responda apenas JSON {"pass":boolean,"violations":[string]}. Reprove qualquer violação substancial.';
    await new Promise(r => setTimeout(r, 4000));
    const review=parse(await generate(JSON.stringify({mode:task.mode,program:task.program,sections}), reviewInstructions,'review',2500));
    const script_sha256=hash(narration);
    result={program:task.program,date:task.date,mode:task.mode,sections,narration,word_count:words(narration),script_sha256,review:{...review,script_sha256},generated_at:new Date().toISOString(),provider:row.provider,model:row.default_model};
    await fs.writeFile(task.output,JSON.stringify(result,null,2),{mode:0o640});
    if(review.pass!==true||!Array.isArray(review.violations)||review.violations.length)throw Error('Revisão editorial reprovou o roteiro: ' + JSON.stringify(review.violations));
  }

  console.error('SCRIPT_VALIDATED_OK words: ' + result.word_count + ' hash: ' + result.script_sha256);

  const speechModel = row.speech_model || 'gemini-3.1-flash-tts-preview';
  const audioPath = task.output.replace(/\.json$/, '.wav');
  const sections = result.sections;
  const sectionAudioPaths = [];
  console.error('SYNTHESIZING_SPEECH (' + sections.length + ' sections)');
  for (let i = 0; i < sections.length; i++) {
    const secPath = `${audioPath}.part-${i+1}.wav`;
    sectionAudioPaths.push(secPath);
    let secExists = false;
    try {
      const st = await fs.stat(secPath);
      if (st.size > 1000) secExists = true;
    } catch {}
    if (secExists) {
      console.error(`AUDIO_PART_REUSED ${i+1}/${sections.length}`);
      continue;
    }
    console.error(`AUDIO_SYNTHESIZING_PART ${i+1}/${sections.length} (${words(sections[i].text)} words)`);
    let partSpeech;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        partSpeech = await gemini.generateSpeech({apiKey, model: speechModel, text: sections[i].text});
        break;
      } catch (e) {
        console.error(`AUDIO_PART_ERROR ${i+1} attempt ${attempt+1}:`, e.message);
        if (attempt === 2) throw e;
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
    await fs.writeFile(secPath, partSpeech.buffer, {mode: 0o640});
    console.error(`AUDIO_PART_READY ${i+1}/${sections.length}`);
  }

  let audioExists = false;
  try {
    const st = await fs.stat(audioPath);
    if (st.size > 10000) audioExists = true;
  } catch {}
  if (!audioExists) {
    const {execFile} = require('node:child_process');
    const util = require('node:util');
    const execFileAsync = util.promisify(execFile);
    const listFile = `${audioPath}.concat.txt`;
    const listContent = sectionAudioPaths.map(p => `file '${p}'`).join('\n');
    await fs.writeFile(listFile, listContent, 'utf8');
    console.error('CONCATENATING_AUDIO');
    await execFileAsync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', audioPath]);
    await fs.unlink(listFile).catch(() => {});
  }

  const manifestPath = task.output.replace(/\.json$/, '-manifest.json');
  const manifest = {
    script_sha256: result.script_sha256,
    broadcast_date: task.date,
    program: task.program,
    audio_wav: audioPath
  };
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), {mode:0o640});

  console.error('RENDERING_AUDIOVISUAL');
  const mp4Path = task.output.replace(/\.json$/, '.mp4');
  const {execFile} = require('node:child_process');
  const util = require('node:util');
  const execFileAsync = util.promisify(execFile);
  
  const probeOutput = await execFileAsync('ffprobe', ['-v', 'error', '-show_format', '-of', 'json', audioPath]);
  const audioDuration = parseFloat(JSON.parse(probeOutput.stdout).format.duration);
  console.error(`AUDIO_MEASURED_DURATION: ${audioDuration.toFixed(2)}s`);
  const expectedSeconds = task.targetSeconds || Math.round(audioDuration);

  const renderScript = require('node:path').join(__dirname, task.mode === 'generic_program' ? 'render-generic-program.py' : 'render-original-reflection.py');
  try {
    await execFileAsync('python3', [renderScript, '--script', task.output, '--manifest', manifestPath, '--seconds', String(expectedSeconds), '--output', mp4Path]);
  } catch (err) {
    throw Error('Render falhou: ' + (err.stderr || err.message));
  }

  const qcPath = mp4Path.replace(/\.mp4$/, '.qc.json');
  const qc = JSON.parse(await fs.readFile(qcPath, 'utf8'));

  const mediaId = 'media-auto-' + crypto.randomUUID();
  const title = task.program + ' — ' + task.date;
  const originalName = require('node:path').basename(mp4Path);
  const drivePath = mp4Path.startsWith('/media/1/') ? mp4Path : require('node:path').join(require('node:path').dirname(task.output), originalName);
  
  const metadata = {
    program_slug: task.program.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    broadcast_date: task.date,
    production_qc: qc,
    target_duration_s: expectedSeconds,
    autonomous_pilot: true
  };

  await pool.query(`
    insert into gsa_tv_media_items
    (id,channel_id,title,original_filename,duration_s,video_codec,video_width,video_height,video_fps,audio_codec,audio_sample_rate,audio_channels,state,rights_ok,drive_path,media_kind,source_type,ai_generated,approval_state,metadata)
    values($1,'ch-main',$2,$3,$4,'h264',1920,1080,30,'aac',48000,2,'ready',true,$5,'program','services',true,'approved',$6::jsonb)
  `, [mediaId, title, originalName, Math.round(qc.duration_s), drivePath, JSON.stringify(metadata)]);

  console.log(JSON.stringify({state:'editorially_and_technically_validated',word_count:result.word_count,script_sha256:result.script_sha256,output:task.output,media_id:mediaId,duration_s:qc.duration_s}));
 }finally{await pool.end();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
