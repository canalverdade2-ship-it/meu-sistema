import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const nodeScript = `
    const { Client } = require('pg');
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    async function run() {
      await client.connect();
      const res = await client.query("SELECT id, title, state, drive_path FROM gsa_tv_media_items ORDER BY created_at DESC LIMIT 5");
      console.log(JSON.stringify(res.rows, null, 2));
      await client.end();
    }
    run().catch(e => { console.error(e); process.exit(1); });
  `;
  const base64 = Buffer.from(nodeScript).toString('base64');
  const cmd = `sudo docker exec gsa-tv-control-plane node -e "eval(Buffer.from('${base64}', 'base64').toString('utf8'))"`;
  const res = await runSshScript(cmd);
  console.log('STDOUT:', res.stdout);
}

main().catch(console.error);
