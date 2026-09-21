import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(String.raw`sudo docker inspect n8n --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -E '^(DB_|N8N_)' | sed -E 's/(PASSWORD|SECRET|KEY)=.*/\1=[PROTECTED]/'
echo WORKFLOWS
sudo docker exec n8n n8n list:workflow 2>/dev/null | grep 'GSA TV' || true
echo CONTAINERS
sudo docker ps --format '{{.Names}}' | grep -E 'postgres|supabase-db' || true`,45000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
