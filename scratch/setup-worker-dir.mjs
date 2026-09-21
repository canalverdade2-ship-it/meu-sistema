import { runSshScript } from './ssh2-run.mjs';

async function setupWorkerDir() {
  const script = `
sudo mkdir -p /opt/gsa-tv/ai-worker
sudo chown -R opc:opc /opt/gsa-tv/ai-worker
cd /opt/gsa-tv/ai-worker
npm init -y
npm install pg
node -e 'require("pg"); console.log("PG INSTALLED SUCCESSFULLY IN WORKER DIR!");'
`;
  const res = await runSshScript(script);
  console.log('OUTPUT:\n', res.stdout, res.stderr);
}

setupWorkerDir().catch(console.error);
