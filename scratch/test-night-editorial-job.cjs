const {Pool}=require('/app/node_modules/pg');
const fs=require('fs');
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const id='67e6b0d1-c7dd-4fd4-8076-66e464fa42c8';
(async()=>{
 const r=await pool.query("SELECT p.* FROM public.gsa_tv_ai_projects p JOIN public.gsa_tv_program_blocks b ON b.id::text=p.metadata->>'editorial_block_id' WHERE p.id=$1 AND b.schedule_version_id='003801b7-5f2d-4da3-a531-915ce52a27f3'",[id]);
 const p=r.rows[0]; if(!p)throw Error('Projeto ausente da grade selecionada');
 const existing=await pool.query("SELECT id,state FROM public.gsa_tv_ai_jobs WHERE project_id=$1 AND created_at>now()-interval '2 hours' ORDER BY created_at DESC LIMIT 1",[id]);
 if(existing.rowCount){console.log(JSON.stringify({already_requested:true,job:existing.rows[0]}));return;}
 if(p.state!=='draft'||p.config?.source_grounded!==true)throw Error('Projeto não elegível para teste source-grounded');
 const backup='/media/1/production/night-test-agro-before-20260910.json';
 fs.mkdirSync('/media/1/production',{recursive:true});
 if(!fs.existsSync(backup))fs.writeFileSync(backup,JSON.stringify(p,null,2),{mode:0o600,flag:'wx'});
 await pool.query("UPDATE public.gsa_tv_ai_projects SET state='approved',autonomy_mode='authorized_routine',metadata=coalesce(metadata,'{}'::jsonb)||$2::jsonb,updated_at=now() WHERE id=$1 AND state='draft'",[id,JSON.stringify({generation_authorization:'user_requested_night_factory_20260909',generation_only:true,no_auto_publish:true})]);
 const response=await fetch(`http://127.0.0.1:${process.env.PORT||9202}/automation/ai/projects/${id}/run`,{method:'POST',headers:{Authorization:`Bearer ${process.env.INTERNAL_API_TOKEN}`,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(30000)});
 const result=await response.json();
 console.log(JSON.stringify({http_status:response.status,accepted:response.ok,job_id:result.job_id,state:result.state,provider:result.provider}));
 if(!response.ok){await pool.query("UPDATE public.gsa_tv_ai_projects SET state=$2,autonomy_mode=$3 WHERE id=$1 AND state='approved'",[id,p.state,p.autonomy_mode]);process.exitCode=1;}
})().catch(e=>{console.error(e.name);process.exitCode=1;}).finally(()=>pool.end());
