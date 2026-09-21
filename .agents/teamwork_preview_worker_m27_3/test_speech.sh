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

  console.log('Testing speech synthesis with model:', row.speech_model);
  const speech = await gemini.generateSpeech({
    apiKey,
    model: row.speech_model,
    text: 'Olá telespectadores da GSA TV, esta é uma transmissão de teste institucional.'
  });
  console.log('Speech success! Buffer length:', speech.buffer.length, 'mimeType:', speech.mimeType);
  await pool.end();
})().catch(e => { console.error('Speech Test Error:', e.message); process.exit(1); });
"
