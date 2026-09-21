#!/usr/bin/env bash
set -e

node - <<'EOF'
const fs = require('fs');
const file = '/opt/gsa-tv/cache/media/1/production/autonomous/tools/autonomous-script.cjs';
let content = fs.readFileSync(file, 'utf8');

// 1. Add fishApiKey loader in main()
const targetKey = `  const apiKey=Buffer.concat([decipher.update(encrypted.subarray(0,-16)),decipher.final()]).toString('utf8');`;
const replaceKey = `  const apiKey=Buffer.concat([decipher.update(encrypted.subarray(0,-16)),decipher.final()]).toString('utf8');
  let fishApiKey = null;
  try {
    const vaultPath = '/media/1/production/autonomous/fish-production.enc.json';
    const v = JSON.parse(await fs.readFile(vaultPath, 'utf8'));
    const k = Buffer.from(process.env.GSA_TV_SECRET_KEY, 'hex');
    const n = Buffer.from(v.nonce, 'base64url');
    const a = Buffer.from(v.ciphertext, 'base64url');
    const d = crypto.createDecipheriv('aes-256-gcm', k, n);
    d.setAAD(Buffer.from(v.aad));
    d.setAuthTag(a.subarray(-16));
    const dec = JSON.parse(Buffer.concat([d.update(a.subarray(0, -16)), d.final()]).toString('utf8'));
    fishApiKey = dec.api_key;
  } catch (err) {
    console.error('Fish vault read note:', err.message);
  }`;

if (!content.includes(targetKey)) {
  console.error('Target key string not found!');
  process.exit(1);
}
content = content.replace(targetKey, replaceKey);

// 2. Add Fish Audio synthesis before Gemini speech fallback
const targetSpeech = `    let partSpeech;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        partSpeech = await gemini.generateSpeech({apiKey, model: speechModel, text: sections[i].text});
        break;
      } catch (e) {
        console.error(\`AUDIO_PART_ERROR \${i+1} attempt \${attempt+1}:\`, e.message);
        if (attempt === 2) throw e;
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
    await fs.writeFile(secPath, partSpeech.buffer, {mode: 0o640});
    console.error(\`AUDIO_PART_READY \${i+1}/\${sections.length}\`);`;

const replaceSpeech = `    let done = false;
    if (fishApiKey) {
      try {
        const resp = await fetch('https://api.fish.audio/v1/tts', {
          method: 'POST',
          signal: AbortSignal.timeout(45000),
          headers: {
            Authorization: \`Bearer \${fishApiKey}\`,
            'Content-Type': 'application/json',
            model: 's2.1-pro-free',
          },
          body: JSON.stringify({
            text: sections[i].text,
            reference_id: '5c8a9b5d0b2549c7ada853529199ebe5',
            format: 'mp3',
            normalize: true,
            latency: 'normal',
            prosody: { speed: 1.0, volume: 0, normalize_loudness: true },
          }),
        });
        if (resp.ok) {
          const {execFile} = require('node:child_process');
          const util = require('node:util');
          const execFileAsync = util.promisify(execFile);
          const mp3Buf = Buffer.from(await resp.arrayBuffer());
          const tmpMp3 = \`\${secPath}.tmp.mp3\`;
          await fs.writeFile(tmpMp3, mp3Buf);
          await execFileAsync('ffmpeg', ['-y', '-i', tmpMp3, '-ar', '48000', '-ac', '2', secPath]);
          await fs.unlink(tmpMp3).catch(() => {});
          done = true;
          console.error(\`AUDIO_PART_READY (Fish Audio) \${i+1}/\${sections.length}\`);
        } else {
          console.error(\`Fish Audio HTTP \${resp.status}, falling back to Gemini\`);
        }
      } catch (err) {
        console.error(\`Fish Audio attempt failed: \${err.message}\`);
      }
    }

    if (!done) {
      let partSpeech;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          partSpeech = await gemini.generateSpeech({apiKey, model: speechModel, text: sections[i].text});
          break;
        } catch (e) {
          console.error(\`AUDIO_PART_ERROR \${i+1} attempt \${attempt+1}:\`, e.message);
          if (attempt === 2) throw e;
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        }
      }
      await fs.writeFile(secPath, partSpeech.buffer, {mode: 0o640});
      console.error(\`AUDIO_PART_READY \${i+1}/\${sections.length}\`);
    }`;

if (!content.includes(targetSpeech)) {
  console.error('Target speech string not found!');
  process.exit(1);
}
content = content.replace(targetSpeech, replaceSpeech);

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully integrated Fish Audio into autonomous-script.cjs!');
EOF

sudo cp /opt/gsa-tv/cache/media/1/production/autonomous/tools/autonomous-script.cjs /opt/gsa-tv/bin/autonomous-script.cjs
docker exec -i gsa-tv-control-plane node -c /media/1/production/autonomous/tools/autonomous-script.cjs && echo 'SYNTAX_OK'
