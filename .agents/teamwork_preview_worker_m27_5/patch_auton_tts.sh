#!/usr/bin/env bash
set -e

echo "=== PATCHING TTS CHUNKING IN autonomous-script.cjs ==="
python3 - << 'EOF'
from pathlib import Path

auton_path = Path('/opt/gsa-tv/cache/media/1/production/autonomous/tools/autonomous-script.cjs')
content = auton_path.read_text(encoding='utf-8')

old_tts = """    if (fishApiKey) {
      try {
        const resp = await fetch('https://api.fish.audio/v1/tts', {
          method: 'POST',
          signal: AbortSignal.timeout(45000),
          headers: {
            Authorization: `Bearer ${fishApiKey}`,
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
          const tmpMp3 = `${secPath}.tmp.mp3`;
          await fs.writeFile(tmpMp3, mp3Buf);
          await execFileAsync('ffmpeg', ['-y', '-i', tmpMp3, '-ar', '48000', '-ac', '2', secPath]);
          await fs.unlink(tmpMp3).catch(() => {});
          done = true;
          console.error(`AUDIO_PART_READY (Fish Audio) ${i+1}/${sections.length}`);
        } else {
          console.error(`Fish Audio HTTP ${resp.status}, falling back to Gemini`);
        }
      } catch (err) {
        console.error(`Fish Audio attempt failed: ${err.message}`);
      }
    }"""

new_tts = """    if (fishApiKey) {
      try {
        const {execFile} = require('node:child_process');
        const util = require('node:util');
        const execFileAsync = util.promisify(execFile);
        const rawParas = sections[i].text.split(/\\n+/).map(p => p.trim()).filter(p => p.length > 5);
        const paraFiles = [];
        let allParasOk = true;
        for (let pIdx = 0; pIdx < rawParas.length; pIdx++) {
          const paraText = rawParas[pIdx];
          const pFile = `${secPath}.p-${pIdx+1}.mp3`;
          let pDone = false;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const resp = await fetch('https://api.fish.audio/v1/tts', {
                method: 'POST',
                signal: AbortSignal.timeout(60000),
                headers: {
                  Authorization: `Bearer ${fishApiKey}`,
                  'Content-Type': 'application/json',
                  model: 's2.1-pro-free',
                },
                body: JSON.stringify({
                  text: paraText,
                  reference_id: '5c8a9b5d0b2549c7ada853529199ebe5',
                  format: 'mp3',
                  normalize: true,
                  latency: 'normal',
                  prosody: { speed: 1.0, volume: 0, normalize_loudness: true },
                }),
              });
              if (resp.ok) {
                const mp3Buf = Buffer.from(await resp.arrayBuffer());
                await fs.writeFile(pFile, mp3Buf);
                paraFiles.push(pFile);
                pDone = true;
                break;
              } else {
                console.error(`Fish Audio para ${pIdx+1} HTTP ${resp.status}`);
              }
            } catch (err) {
              console.error(`Fish Audio para ${pIdx+1} attempt ${attempt+1} failed: ${err.message}`);
            }
            await new Promise(r => setTimeout(r, 1500));
          }
          if (!pDone) {
            allParasOk = false;
            break;
          }
        }
        if (allParasOk && paraFiles.length > 0) {
          const listFile = `${secPath}.plist.txt`;
          const listContent = paraFiles.map(f => `file '${f}'`).join('\\n');
          await fs.writeFile(listFile, listContent, 'utf8');
          await execFileAsync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-ar', '48000', '-ac', '2', secPath]);
          await fs.unlink(listFile).catch(() => {});
          for (const f of paraFiles) await fs.unlink(f).catch(() => {});
          done = true;
          console.error(`AUDIO_PART_READY (Fish Audio paragraphs: ${paraFiles.length}) ${i+1}/${sections.length}`);
        }
      } catch (err) {
        console.error(`Fish Audio section failed: ${err.message}`);
      }
    }"""

if old_tts in content:
    content = content.replace(old_tts, new_tts)
    auton_path.write_text(content, encoding='utf-8')
    print("PATCHED_AUTON_TTS_SUCCESSFULLY")
else:
    if "AUDIO_PART_READY (Fish Audio paragraphs:" in content:
        print("ALREADY_PATCHED_AUTON_TTS")
    else:
        print("ERROR: OLD_TTS_NOT_FOUND")
EOF
