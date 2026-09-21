import { execSync } from 'child_process';
const script = `cd /opt/gsa-tv/control-plane
cat << 'EOF' | node
const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub' });
pool.query("SELECT id, job_type, status, error FROM public.gsa_tv_jobs WHERE job_type = 'compile_playlist' ORDER BY created_at DESC LIMIT 5;")
  .then(res => { console.table(res.rows); pool.end(); })
  .catch(err => { console.error(err); pool.end(); });
EOF
`;
import fs from 'fs';
fs.writeFileSync('scratch/check_jobs3.sh', script);
execSync('node scratch/vps-exec.mjs -f scratch/check_jobs3.sh', { stdio: 'inherit' });
