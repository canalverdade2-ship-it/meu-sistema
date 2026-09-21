import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker exec gsa-tv-control-plane node -e '
const { Pool } = require("pg");
const crypto = require("crypto");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const r = await pool.query("select stream_key_ciphertext from public.gsa_tv_channel_secrets where channel_id=\\"ch-main\\"");
  console.log("CIPHERTEXT:", r.rows[0].stream_key_ciphertext);
  // check how app.js decrypts it
})();
'
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
