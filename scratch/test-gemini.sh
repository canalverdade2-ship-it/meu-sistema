docker exec gsa-tv-control-plane node -e "
const gemini = require('/app/src/gemini.js');
const crypto = require('crypto');
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const row = (await pool.query(\"select * from gsa_tv_ai_provider_secrets where channel_id='ch-main' order by updated_at desc limit 1\")).rows[0];
  const [version, ivPart, bodyPart] = row.api_key_ciphertext.split('.');
  const encrypted = Buffer.from(bodyPart, 'base64url');
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(process.env.GSA_TV_SECRET_KEY, 'hex'), Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(encrypted.subarray(-16));
  const apiKey = Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()]).toString('utf8');

  console.log('Testing generateText with gemini-3.1-flash-lite...');
  const res = await gemini.generateText({ apiKey, model: 'gemini-3.1-flash-lite', prompt: 'Diga: GEMINI OPERACIONAL' });
  console.log('RESULT:', res.text.trim());
  await pool.end();
})().catch(err => {
  console.error('TEST ERROR:', err.message);
  process.exit(1);
});
"
