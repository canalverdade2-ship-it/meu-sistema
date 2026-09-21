#!/usr/bin/env bash
sudo cp /home/opc/gsa-ai/secrets/fish-production.enc.json /opt/gsa-tv/cache/media/1/production/autonomous/fish-production.enc.json
sudo chmod 666 /opt/gsa-tv/cache/media/1/production/autonomous/fish-production.enc.json

docker exec -i gsa-tv-control-plane node - <<'EOF'
const fs = require('fs');
const crypto = require('crypto');

const vaultPath = '/media/1/production/autonomous/fish-production.enc.json';
const v = JSON.parse(fs.readFileSync(vaultPath, 'utf8'));
const k = Buffer.from(process.env.GSA_TV_SECRET_KEY, 'hex');
const n = Buffer.from(v.nonce, 'base64url');
const a = Buffer.from(v.ciphertext, 'base64url');
const t = a.subarray(-16);
const b = a.subarray(0, -16);
const d = crypto.createDecipheriv('aes-256-gcm', k, n);
d.setAAD(Buffer.from(v.aad));
d.setAuthTag(t);
const decrypted = JSON.parse(Buffer.concat([d.update(b), d.final()]).toString('utf8'));
console.log('Decrypted Fish Key in Container: length', decrypted.api_key.length);

(async () => {
  const t0 = Date.now();
  console.log('Calling Fish Audio API...');
  const resp = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    signal: AbortSignal.timeout(30000),
    headers: {
      Authorization: `Bearer ${decrypted.api_key}`,
      'Content-Type': 'application/json',
      model: 's2.1-pro-free',
    },
    body: JSON.stringify({
      text: 'Olá telespectadores da GSA TV, esta é uma transmissão oficial.',
      reference_id: '5c8a9b5d0b2549c7ada853529199ebe5',
      format: 'mp3',
      normalize: true,
      latency: 'normal',
      prosody: { speed: 1.0, volume: 0, normalize_loudness: true },
    }),
  });
  console.log('Fish Audio Status:', resp.status, 'Time:', (Date.now() - t0) + 'ms');
  if (!resp.ok) {
    console.error('Body:', await resp.text());
  } else {
    const buf = await resp.arrayBuffer();
    console.log('Audio received! Bytes:', buf.byteLength);
  }
})();
EOF
