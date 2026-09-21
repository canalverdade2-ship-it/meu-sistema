import { runSshScript } from './ssh2-run.mjs';

async function checkGeminiKeys() {
  const script = `
sudo docker exec gsa-tv-control-plane node -e '
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
  try {
    const res = await pool.query("SELECT * FROM gsa_tv_settings WHERE key ILIKE $1 OR key ILIKE $2", ["%gemini%", "%ai%"]);
    console.log("Found Gemini/AI settings:", res.rows);
    if (res.rows.length > 0) {
      await pool.query("DELETE FROM gsa_tv_settings WHERE key ILIKE $1", ["%gemini%"]);
      console.log("Deleted any gemini settings.");
    }
  } catch(e) {
    console.error("DB error:", e.message);
  } finally {
    await pool.end();
  }
}
run();
'
`;
  const res = await runSshScript(script);
  console.log('STDOUT:\n', res.stdout);
}

checkGeminiKeys().catch(console.error);
