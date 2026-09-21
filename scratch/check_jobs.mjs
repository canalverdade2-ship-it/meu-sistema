import { execSync } from 'child_process';
const script = `cat << 'EOF' | node
const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:S4nt0r!n!2026@127.0.0.1:5432/gsa_tv' });
pool.query("SELECT id, job_type, status, error FROM public.gsa_tv_jobs ORDER BY created_at DESC LIMIT 5;")
  .then(res => { console.table(res.rows); pool.end(); })
  .catch(err => { console.error(err); pool.end(); });
EOF
`;
import fs from 'fs';
fs.writeFileSync('scratch/check_jobs2.sh', script);
execSync('node scratch/vps-exec.mjs -f scratch/check_jobs2.sh', { stdio: 'inherit' });
