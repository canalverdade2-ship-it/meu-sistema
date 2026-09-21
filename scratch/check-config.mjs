import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const cmd = `sudo docker exec gsa-tv-control-plane node -e "
    const { Client } = require('pg');
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    client.connect().then(async () => {
      const res = await client.query('SELECT id, config FROM gsa_tv_channels');
      console.log(JSON.stringify(res.rows, null, 2));
      await client.end();
    }).catch(err => { console.error(err); process.exit(1); });
  "`;
  const res = await runSshScript(cmd);
  console.log('STDOUT:', res.stdout);
  console.log('STDERR:', res.stderr);
}

main().catch(console.error);
