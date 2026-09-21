import { runSshScript } from './ssh2-run.mjs';
const script=`set -euo pipefail
python3 - <<'PY'
from pathlib import Path
p=Path('/home/opc/gsa-hub/docker-compose.yml')
for i,line in enumerate(p.read_text().splitlines(),1):
    if any(k in line for k in ['POSTGRES_PASSWORD','DB_POSTGRESDB_PASSWORD','N8N_ENCRYPTION_KEY','AUTH_API_KEY']):
        key=line.split(':',1)[0] if ':' in line else line.split('=',1)[0]
        indent=line[:len(line)-len(line.lstrip())]
        print(f'{i:03d}: {indent}{key.strip()}: <redacted>')
    elif 'sensitive-setting' in line.lower():
        print(f'{i:03d}: <redacted-sensitive-setting>')
    else:
        print(f'{i:03d}: {line}')
PY
`;
const r=await runSshScript(script,60000);process.stdout.write(r.stdout);process.stderr.write(r.stderr);
