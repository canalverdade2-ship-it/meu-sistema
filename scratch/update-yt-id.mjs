import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const nodeScript = `
    const { Client } = require('pg');
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    async function run() {
      await client.connect();
      await client.query("UPDATE gsa_tv_channels SET config = jsonb_set(config, '{youtube_video_id}', '\\"h93W7gyx-fk\\"') WHERE id = 'ch-main'");
      const res = await client.query("SELECT id, config FROM gsa_tv_channels WHERE id = 'ch-main'");
      console.log('UPDATED CONFIG:', JSON.stringify(res.rows[0].config, null, 2));
      await client.end();
    }
    run().catch(e => { console.error(e); process.exit(1); });
  `;
  const base64 = Buffer.from(nodeScript).toString('base64');
  const cmd = `sudo docker exec gsa-tv-control-plane node -e "eval(Buffer.from('${base64}', 'base64').toString('utf8'))"`;
  const res = await runSshScript(cmd);
  console.log('STDOUT:', res.stdout);
  console.log('STDERR:', res.stderr);
}

main().catch(console.error);
