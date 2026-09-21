#!/usr/bin/env bash
docker exec -i gsa-tv-control-plane node -e "
const crypto = require('crypto');
const {Pool} = require('/app/node_modules/pg');
const gemini = require('/app/src/gemini.js');

(async () => {
  const pool = new Pool({connectionString: process.env.DATABASE_URL});
  const row = (await pool.query(\"select * from gsa_tv_ai_provider_secrets where channel_id='ch-main' order by updated_at desc limit 1\")).rows[0];
  const [version, ivPart, bodyPart] = row.api_key_ciphertext.split('.');
  const encrypted = Buffer.from(bodyPart, 'base64url');
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(process.env.GSA_TV_SECRET_KEY, 'hex'), Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(encrypted.subarray(-16));
  const apiKey = Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()]).toString('utf8');

  console.log('Testing Gemini API with model:', row.default_model);
  const text = await gemini.generateText({
    apiKey,
    model: row.default_model,
    prompt: 'Olá, este é um teste rápido de conectividade. Responda apenas OK.',
    instructions: 'Responda apenas OK.',
    webSearch: false
  });
  console.log('Gemini Response:', text.trim());
  await pool.end();
})().catch(e => { console.error('Gemini Test Error:', e.message); process.exit(1); });
"
