docker exec gsa-tv-control-plane node -e "
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

  const testModels = ['gemini-2.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'];
  for (const model of testModels) {
    try {
      console.log('Testing model:', model);
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Diga apenas: OK' }] }] })
      });
      const data = await res.json();
      if (!res.ok) {
        console.log('  -> Failed ' + res.status + ':', data.error?.message?.slice(0, 120));
      } else {
        const txt = data.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log('  -> SUCCESS! Response:', txt?.trim());
        break;
      }
    } catch (e) {
      console.log('  -> Error:', e.message);
    }
  }
  await pool.end();
})().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
"
