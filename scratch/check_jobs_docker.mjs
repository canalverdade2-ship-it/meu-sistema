import { execSync } from 'child_process';
const cmd = `sudo docker exec evo-postgres psql postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5432/gsahub -c "SELECT id, job_type, status, error FROM public.gsa_tv_jobs WHERE job_type = 'compile_playlist' ORDER BY created_at DESC LIMIT 5;"`;
import fs from 'fs';
fs.writeFileSync('scratch/check_jobs_docker.sh', cmd);
execSync('node scratch/vps-exec.mjs -f scratch/check_jobs_docker.sh', { stdio: 'inherit' });
