#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'ssh2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VPS_HOST = process.env.VPS_HOST || '147.15.43.141';
const VPS_PORT = parseInt(process.env.VPS_PORT || '22', 10);
const VPS_USER = process.env.VPS_USER || 'opc';
const PROD_TARGET_DIR = '/opt/gsa-tv/cache/media/1/identity/audio';
const VALIDATOR_REMOTE = '/home/opc/teamwork_projects/audio_identity_builder/validate-audio-inventory.sh';
const SANDBOX_BASE = `/tmp/challenger_stress_sandbox_${Date.now()}`;

function resolvePrivateKey() {
  const candidatePaths = [
    process.env.SSH_KEY_PATH,
    'C:/Users/Adriano Farias/Downloads/CLOUD/ssh-key-2026-07-30.key',
    path.resolve(process.env.USERPROFILE || process.env.HOME || '.', 'Downloads/CLOUD/ssh-key-2026-07-30.key')
  ].filter(Boolean);

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) return fs.readFileSync(p);
  }
  throw new Error('Unable to locate SSH private key.');
}

class RemoteSshSession {
  constructor(host, port, username, privateKey) {
    this.host = host;
    this.port = port;
    this.username = username;
    this.privateKey = privateKey;
    this.client = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.client = new Client();
      const timer = setTimeout(() => {
        this.client.end();
        reject(new Error(`SSH connection timeout to ${this.host}:${this.port}`));
      }, 15000);

      this.client.on('ready', () => {
        clearTimeout(timer);
        resolve(this);
      });

      this.client.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });

      this.client.connect({
        host: this.host,
        port: this.port,
        username: this.username,
        privateKey: this.privateKey,
        readyTimeout: 15000
      });
    });
  }

  exec(command, timeoutMs = 120000) {
    return new Promise((resolve, reject) => {
      if (!this.client) return reject(new Error('SSH client not connected'));

      const timer = setTimeout(() => {
        reject(new Error(`SSH command timeout (${timeoutMs}ms): ${command}`));
      }, timeoutMs);

      this.client.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timer);
          return reject(err);
        }

        let stdout = '';
        let stderr = '';

        stream.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
        stream.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });

        stream.on('close', (code, signal) => {
          clearTimeout(timer);
          resolve({
            code: code ?? (signal ? 128 : 0),
            signal,
            stdout: stdout.trim(),
            stderr: stderr.trim()
          });
        });
      });
    });
  }

  close() {
    if (this.client) {
      this.client.end();
      this.client = null;
    }
  }
}

async function runChallengerStressTest() {
  console.log('================================================================================');
  console.log('    CHALLENGER 1: INVENTORY & BOUNDARY STRESS TEST + LIVE AUDIT HARNESS        ');
  console.log('================================================================================');
  console.log(`VPS Target  : ${VPS_HOST}:${VPS_PORT} (${VPS_USER})`);
  console.log(`Sandbox Dir : ${SANDBOX_BASE}`);
  console.log(`Live Target : ${PROD_TARGET_DIR}`);
  console.log(`Timestamp   : ${new Date().toISOString()}`);
  console.log('--------------------------------------------------------------------------------\n');

  const privateKey = resolvePrivateKey();
  const ssh = new RemoteSshSession(VPS_HOST, VPS_PORT, VPS_USER, privateKey);
  await ssh.connect();
  console.log('✓ SSH connection established to Oracle VPS\n');

  const testResults = [];
  function recordTest(name, passed, details = '', empirical = {}) {
    testResults.push({ name, passed, details, empirical });
    const mark = passed ? '[\x1b[32mPASS\x1b[0m]' : '[\x1b[31mFAIL\x1b[0m]';
    console.log(`  ${mark} ${name}`);
    if (details) {
      console.log(`         Details: ${details}`);
    }
  }

  try {
    // -------------------------------------------------------------------------
    // PART 1: DIRECT FORENSIC AUDIT OF LIVE FILESYSTEM
    // -------------------------------------------------------------------------
    console.log('>>> PART 1: DIRECT FORENSIC AUDIT OF LIVE PRODUCTION FILESYSTEM');

    const categories = ['news', 'viral', 'faith', 'lifestyle', 'sfx'];
    const auditPyScript = `
import os, glob, json

base_dir = "${PROD_TARGET_DIR}"
categories = ["news", "viral", "faith", "lifestyle", "sfx"]
result = {
    "base_exists": os.path.isdir(base_dir),
    "categories": {},
    "total_audio_files": 0,
    "zero_byte_files": [],
    "stub_files": [],
    "non_audio_files": [],
    "total_size_bytes": 0
}

for cat in categories:
    cat_dir = os.path.join(base_dir, cat)
    exists = os.path.isdir(cat_dir)
    cat_files = os.listdir(cat_dir) if exists else []
    cat_valid = 0
    cat_size = 0
    cat_sizes_list = []
    for f in cat_files:
        fpath = os.path.join(cat_dir, f)
        if not os.path.isfile(fpath):
            continue
        sz = os.path.getsize(fpath)
        ext = os.path.splitext(f)[1].lower()
        if ext in [".mp3", ".wav", ".m4a"]:
            cat_valid += 1
            cat_size += sz
            cat_sizes_list.append(sz)
            if sz == 0:
                result["zero_byte_files"].append(fpath)
            elif sz < 4096:
                result["stub_files"].append({"path": fpath, "size": sz})
        else:
            result["non_audio_files"].append(fpath)
    result["categories"][cat] = {
        "exists": exists,
        "count": cat_valid,
        "size_bytes": cat_size,
        "min_size": min(cat_sizes_list) if cat_sizes_list else 0,
        "max_size": max(cat_sizes_list) if cat_sizes_list else 0,
        "avg_size": (cat_size / len(cat_sizes_list)) if cat_sizes_list else 0
    }
    result["total_audio_files"] += cat_valid
    result["total_size_bytes"] += cat_size

print(json.dumps(result))
`;

    const b64Py = Buffer.from(auditPyScript).toString('base64');
    const liveAuditRes = await ssh.exec(`echo "${b64Py}" | base64 -d | python3`);
    if (liveAuditRes.code !== 0) {
      throw new Error(`Python audit failed on VPS: ${liveAuditRes.stderr || liveAuditRes.stdout}`);
    }

    const auditData = JSON.parse(liveAuditRes.stdout);

    recordTest(
      'Live Audit: Base audio directory exists',
      auditData.base_exists === true,
      `Directory ${PROD_TARGET_DIR} exists on VPS`,
      { base_exists: auditData.base_exists }
    );

    const allCatsExist = categories.every(c => auditData.categories[c]?.exists === true);
    recordTest(
      'Live Audit: All 5 required category subdirectories exist',
      allCatsExist,
      categories.map(c => `${c}: ${auditData.categories[c]?.exists}`).join(', '),
      { categories: auditData.categories }
    );

    const totalCount = auditData.total_audio_files;
    recordTest(
      'Live Audit: Total valid audio file count >= 200',
      totalCount >= 200,
      `Found ${totalCount} valid audio files (Threshold >= 200)`,
      { total_count: totalCount, target_min: 200 }
    );

    const catDistDetails = categories.map(c => `${c}=${auditData.categories[c]?.count}`).join(', ');
    const balanced = categories.every(c => (auditData.categories[c]?.count || 0) >= 30);
    recordTest(
      'Live Audit: Category distribution balance (>= 30 per category)',
      balanced,
      `Distribution: ${catDistDetails}`,
      { distribution: auditData.categories }
    );

    recordTest(
      'Live Audit: Total absence of 0-byte files in audio categories',
      auditData.zero_byte_files.length === 0,
      `Zero-byte count: ${auditData.zero_byte_files.length}`,
      { zero_byte_files: auditData.zero_byte_files }
    );

    recordTest(
      'Live Audit: Total absence of stub files (<4096 bytes) in audio categories',
      auditData.stub_files.length === 0,
      `Stub count: ${auditData.stub_files.length}`,
      { stub_files: auditData.stub_files }
    );

    recordTest(
      'Live Audit: Absence of non-audio files in category folders',
      auditData.non_audio_files.length === 0,
      `Non-audio count: ${auditData.non_audio_files.length}`,
      { non_audio_files: auditData.non_audio_files }
    );

    console.log(`\n  [INFO] Total production audio footprint: ${(auditData.total_size_bytes / (1024*1024)).toFixed(2)} MB`);
    for (const c of categories) {
      const cInfo = auditData.categories[c];
      console.log(`  [INFO]   ${c.padEnd(10)}: ${cInfo.count} files | min: ${cInfo.min_size}B | max: ${(cInfo.max_size/(1024*1024)).toFixed(2)}MB | avg: ${(cInfo.avg_size/(1024*1024)).toFixed(2)}MB`);
    }

    const sampleMagicRes = await ssh.exec(`
      for cat in news viral faith lifestyle sfx; do
        first_f=$(find ${PROD_TARGET_DIR}/$cat -type f -name "*.mp3" -o -name "*.wav" | head -n 1)
        if [ -n "$first_f" ]; then
          echo "$cat: $(file -b "$first_f")"
        fi
      done
    `);
    console.log('\n  [INFO] Direct file header inspection across categories:');
    sampleMagicRes.stdout.split('\n').forEach(line => console.log(`         ${line}`));

    const liveValRes = await ssh.exec(`bash ${VALIDATOR_REMOTE} --target ${PROD_TARGET_DIR} --json`);
    let liveValJson = null;
    try {
      liveValJson = JSON.parse(liveValRes.stdout);
    } catch (e) {}

    recordTest(
      'Live Audit: validate-audio-inventory.sh returns exit code 0 on live storage',
      liveValRes.code === 0 && liveValJson?.status === 'PASS' && liveValJson?.total_valid_audio_files >= 200,
      `Exit: ${liveValRes.code}, Status: ${liveValJson?.status}, Files: ${liveValJson?.total_valid_audio_files}`,
      { code: liveValRes.code, json: liveValJson }
    );

    // -------------------------------------------------------------------------
    // PART 2: ADVERSARIAL BOUNDARY & STRESS TESTING OF validate-audio-inventory.sh
    // -------------------------------------------------------------------------
    console.log('\n>>> PART 2: ADVERSARIAL BOUNDARY & STRESS TESTING OF validate-audio-inventory.sh');

    await ssh.exec(`rm -rf ${SANDBOX_BASE} && mkdir -p ${SANDBOX_BASE}`);

    const setupScenario = async (subDir) => {
      const p = `${SANDBOX_BASE}/${subDir}`;
      await ssh.exec(`mkdir -p "${p}"`);
      return p;
    };

    const createAudioFiles = async (dir, count, prefix, sizeBytes = 5000, ext = 'mp3') => {
      const script = `mkdir -p "${dir}" && for i in $(seq 1 ${count}); do dd if=/dev/zero of="${dir}/${prefix}_$i.${ext}" bs=${sizeBytes} count=1 status=none; done`;
      await ssh.exec(script);
    };

    // Case 1: Non-existent base directory
    {
      const nonExistent = `${SANDBOX_BASE}/non_existent_folder_xyz`;
      const res = await ssh.exec(`bash ${VALIDATOR_REMOTE} --target "${nonExistent}" --json`);
      let j = {};
      try { j = JSON.parse(res.stdout); } catch (e) {}
      recordTest(
        'Boundary Test 1: Non-existent base directory causes non-zero exit',
        res.code !== 0 && j.status === 'FAIL' && j.reasons?.some(r => r.includes('does not exist')),
        `Code: ${res.code}, Status: ${j.status}`,
        { res }
      );
    }

    // Case 2: Missing 1 required category (missing 'news')
    {
      const scDir = await setupScenario('scenario_missing_news');
      for (const c of ['viral', 'faith', 'lifestyle', 'sfx']) {
        await createAudioFiles(`${scDir}/${c}`, 50, 'track', 5000, 'mp3');
      }
      const res = await ssh.exec(`bash ${VALIDATOR_REMOTE} --target "${scDir}" --json`);
      let j = {};
      try { j = JSON.parse(res.stdout); } catch (e) {}
      recordTest(
        'Boundary Test 2: Missing single category (news) rejected with non-zero exit',
        res.code !== 0 && j.status === 'FAIL' && j.categories?.news?.status === 'MISSING',
        `Code: ${res.code}, News status: ${j.categories?.news?.status}`,
        { res }
      );
    }

    // Case 3: Missing multiple categories (missing 'faith' and 'sfx')
    {
      const scDir = await setupScenario('scenario_missing_faith_sfx');
      for (const c of ['news', 'viral', 'lifestyle']) {
        await createAudioFiles(`${scDir}/${c}`, 70, 'track', 5000, 'mp3');
      }
      const res = await ssh.exec(`bash ${VALIDATOR_REMOTE} --target "${scDir}" --json`);
      let j = {};
      try { j = JSON.parse(res.stdout); } catch (e) {}
      recordTest(
        'Boundary Test 3: Missing multiple categories (faith, sfx) rejected with non-zero exit',
        res.code !== 0 && j.categories?.faith?.status === 'MISSING' && j.categories?.sfx?.status === 'MISSING',
        `Code: ${res.code}, Faith: ${j.categories?.faith?.status}, Sfx: ${j.categories?.sfx?.status}`,
        { res }
      );
    }

    // Case 4: Categories exist but completely empty (0 files)
    {
      const scDir = await setupScenario('scenario_all_empty');
      for (const c of categories) {
        await ssh.exec(`mkdir -p "${scDir}/${c}"`);
      }
      const res = await ssh.exec(`bash ${VALIDATOR_REMOTE} --target "${scDir}" --json`);
      let j = {};
      try { j = JSON.parse(res.stdout); } catch (e) {}
      recordTest(
        'Boundary Test 4: All categories empty (0 files) rejected with non-zero exit',
        res.code !== 0 && j.status === 'FAIL' && j.total_valid_audio_files === 0,
        `Code: ${res.code}, Total counted: ${j.total_valid_audio_files}`,
        { res }
      );
    }

    // Case 5: 199 valid files (off-by-one below 200 threshold)
    {
      const scDir = await setupScenario('scenario_199_files');
      for (const c of ['news', 'viral', 'faith', 'lifestyle']) {
        await createAudioFiles(`${scDir}/${c}`, 40, 'valid', 5000, 'mp3');
      }
      await createAudioFiles(`${scDir}/sfx`, 39, 'valid', 5000, 'wav');
      const res = await ssh.exec(`bash ${VALIDATOR_REMOTE} --target "${scDir}" --json`);
      let j = {};
      try { j = JSON.parse(res.stdout); } catch (e) {}
      recordTest(
        'Boundary Test 5: Off-by-one threshold (199 files < 200) rejected with non-zero exit',
        res.code !== 0 && j.status === 'FAIL' && j.total_valid_audio_files === 199,
        `Code: ${res.code}, Total counted: ${j.total_valid_audio_files}`,
        { res }
      );
    }

    // Case 6: Exactly 200 valid files (exact threshold boundary)
    {
      const scDir = await setupScenario('scenario_200_files');
      for (const c of categories) {
        await createAudioFiles(`${scDir}/${c}`, 40, 'valid', 5000, 'mp3');
      }
      const res = await ssh.exec(`bash ${VALIDATOR_REMOTE} --target "${scDir}" --json`);
      let j = {};
      try { j = JSON.parse(res.stdout); } catch (e) {}
      recordTest(
        'Boundary Test 6: Exact threshold boundary (200 files == 200) passes with exit code 0',
        res.code === 0 && j.status === 'PASS' && j.total_valid_audio_files === 200,
        `Code: ${res.code}, Total counted: ${j.total_valid_audio_files}`,
        { res }
      );
    }

    // Case 7: Zero-byte file present (0 bytes)
    {
      const scDir = await setupScenario('scenario_zero_byte');
      for (const c of categories) {
        await createAudioFiles(`${scDir}/${c}`, 40, 'valid', 5000, 'mp3');
      }
      await ssh.exec(`touch "${scDir}/news/zero_track.mp3"`);
      const res = await ssh.exec(`bash ${VALIDATOR_REMOTE} --target "${scDir}" --json`);
      let j = {};
      try { j = JSON.parse(res.stdout); } catch (e) {}
      recordTest(
        'Boundary Test 7: Zero-byte audio file triggers stub rejection and non-zero exit',
        res.code !== 0 && j.status === 'FAIL' && j.corrupt_or_stub_files >= 1 && j.categories?.news?.stub_files >= 1,
        `Code: ${res.code}, Stubs: ${j.corrupt_or_stub_files}, News stubs: ${j.categories?.news?.stub_files}`,
        { res }
      );
    }

    // Case 8: 1-byte stub file (1 byte)
    {
      const scDir = await setupScenario('scenario_1byte_stub');
      for (const c of categories) {
        await createAudioFiles(`${scDir}/${c}`, 40, 'valid', 5000, 'mp3');
      }
      await ssh.exec(`echo -n "x" > "${scDir}/viral/corrupt_1byte.wav"`);
      const res = await ssh.exec(`bash ${VALIDATOR_REMOTE} --target "${scDir}" --json`);
      let j = {};
      try { j = JSON.parse(res.stdout); } catch (e) {}
      recordTest(
        'Boundary Test 8: 1-byte audio file triggers stub rejection and non-zero exit',
        res.code !== 0 && j.status === 'FAIL' && j.categories?.viral?.stub_files >= 1,
        `Code: ${res.code}, Viral stubs: ${j.categories?.viral?.stub_files}`,
        { res }
      );
    }

    // Case 9: 4095-byte file (boundary: 4096 - 1)
    {
      const scDir = await setupScenario('scenario_4095_bytes');
      for (const c of categories) {
        await createAudioFiles(`${scDir}/${c}`, 40, 'valid', 5000, 'mp3');
      }
      await ssh.exec(`dd if=/dev/zero of="${scDir}/faith/near_stub_4095.mp3" bs=4095 count=1 status=none`);
      const res = await ssh.exec(`bash ${VALIDATOR_REMOTE} --target "${scDir}" --json`);
      let j = {};
      try { j = JSON.parse(res.stdout); } catch (e) {}
      recordTest(
        'Boundary Test 9: 4095-byte file (threshold - 1) correctly classified as stub and rejected',
        res.code !== 0 && j.status === 'FAIL' && j.categories?.faith?.stub_files === 1,
        `Code: ${res.code}, Faith stubs: ${j.categories?.faith?.stub_files}`,
        { res }
      );
    }

    // Case 10: 4096-byte file (boundary: exactly threshold)
    {
      const scDir = await setupScenario('scenario_4096_bytes');
      for (const c of categories) {
        await createAudioFiles(`${scDir}/${c}`, 40, 'valid', 4096, 'mp3');
      }
      const res = await ssh.exec(`bash ${VALIDATOR_REMOTE} --target "${scDir}" --json`);
      let j = {};
      try { j = JSON.parse(res.stdout); } catch (e) {}
      recordTest(
        'Boundary Test 10: Exactly 4096-byte files (threshold) classified as valid, 0 stubs',
        res.code === 0 && j.status === 'PASS' && j.corrupt_or_stub_files === 0 && j.total_valid_audio_files === 200,
        `Code: ${res.code}, Total valid: ${j.total_valid_audio_files}, Stubs: ${j.corrupt_or_stub_files}`,
        { res }
      );
    }

    // Case 11: Non-audio files present (.txt, .json, .sh, .mp4, .aac)
    {
      const scDir = await setupScenario('scenario_nonaudio_files');
      for (const c of categories) {
        await createAudioFiles(`${scDir}/${c}`, 39, 'audio', 5000, 'mp3');
        await ssh.exec(`echo "note" > "${scDir}/${c}/readme.txt"`);
        await ssh.exec(`echo "{}" > "${scDir}/${c}/manifest.json"`);
        await ssh.exec(`echo "#!/bin/sh" > "${scDir}/${c}/script.sh"`);
        await ssh.exec(`dd if=/dev/zero of="${scDir}/${c}/video.mp4" bs=10000 count=1 status=none`);
        await ssh.exec(`dd if=/dev/zero of="${scDir}/${c}/audio.aac" bs=10000 count=1 status=none`);
      }
      const res = await ssh.exec(`bash ${VALIDATOR_REMOTE} --target "${scDir}" --json`);
      let j = {};
      try { j = JSON.parse(res.stdout); } catch (e) {}
      recordTest(
        'Boundary Test 11: Non-audio extensions (.txt, .json, .sh, .mp4, .aac) ignored by inventory counter',
        res.code !== 0 && j.total_valid_audio_files === 195,
        `Total valid audio counted: ${j.total_valid_audio_files} (expected 195, ignoring 25 non-audio files)`,
        { res }
      );
    }

    // Case 12: Upper-case audio extensions (.MP3, .WAV, .M4A)
    {
      const scDir = await setupScenario('scenario_uppercase_extensions');
      await createAudioFiles(`${scDir}/news`, 40, 'track', 5000, 'MP3');
      await createAudioFiles(`${scDir}/viral`, 40, 'track', 5000, 'WAV');
      await createAudioFiles(`${scDir}/faith`, 40, 'track', 5000, 'M4A');
      await createAudioFiles(`${scDir}/lifestyle`, 40, 'track', 5000, 'mp3');
      await createAudioFiles(`${scDir}/sfx`, 40, 'track', 5000, 'wav');
      const res = await ssh.exec(`bash ${VALIDATOR_REMOTE} --target "${scDir}" --json`);
      let j = {};
      try { j = JSON.parse(res.stdout); } catch (e) {}
      recordTest(
        'Boundary Test 12: Upper-case audio extensions (.MP3, .WAV, .M4A) accepted case-insensitively',
        res.code === 0 && j.status === 'PASS' && j.total_valid_audio_files === 200,
        `Code: ${res.code}, Total counted: ${j.total_valid_audio_files}`,
        { res }
      );
    }

    // Case 13: Nested subdirectories inside category (maxdepth 1 test)
    {
      const scDir = await setupScenario('scenario_nested_dirs');
      for (const c of ['news', 'viral', 'faith', 'lifestyle']) {
        await createAudioFiles(`${scDir}/${c}`, 40, 'track', 5000, 'mp3');
      }
      await createAudioFiles(`${scDir}/sfx`, 39, 'track', 5000, 'wav');
      await createAudioFiles(`${scDir}/sfx/nested_subfolder`, 5, 'nested_track', 5000, 'wav');
      const res = await ssh.exec(`bash ${VALIDATOR_REMOTE} --target "${scDir}" --json`);
      let j = {};
      try { j = JSON.parse(res.stdout); } catch (e) {}
      recordTest(
        'Boundary Test 13: Nested subdirectories inside category folders are excluded (maxdepth 1)',
        res.code !== 0 && j.total_valid_audio_files === 199 && j.categories?.sfx?.valid_files === 39,
        `Sfx counted: ${j.categories?.sfx?.valid_files} (expected 39, ignoring 5 in subfolder)`,
        { res }
      );
    }

    // Case 14: Non-audio files with audio-like substring (e.g. song.mp3.bak, sound.wav.tmp)
    {
      const scDir = await setupScenario('scenario_trailing_extensions');
      for (const c of categories) {
        await createAudioFiles(`${scDir}/${c}`, 39, 'audio', 5000, 'mp3');
        await ssh.exec(`dd if=/dev/zero of="${scDir}/${c}/backup.mp3.bak" bs=5000 count=1 status=none`);
        await ssh.exec(`dd if=/dev/zero of="${scDir}/${c}/temp.wav.tmp" bs=5000 count=1 status=none`);
      }
      const res = await ssh.exec(`bash ${VALIDATOR_REMOTE} --target "${scDir}" --json`);
      let j = {};
      try { j = JSON.parse(res.stdout); } catch (e) {}
      recordTest(
        'Boundary Test 14: Files with trailing extensions (song.mp3.bak, sound.wav.tmp) are rejected',
        res.code !== 0 && j.total_valid_audio_files === 195,
        `Total counted: ${j.total_valid_audio_files} (expected 195, trailing extensions not counted)`,
        { res }
      );
    }

    // Case 15: Multiple stubs distributed across multiple categories
    {
      const scDir = await setupScenario('scenario_multi_cat_stubs');
      for (const c of categories) {
        await createAudioFiles(`${scDir}/${c}`, 40, 'valid', 5000, 'mp3');
      }
      await ssh.exec(`dd if=/dev/zero of="${scDir}/lifestyle/stub_a.mp3" bs=500 count=1 status=none`);
      await ssh.exec(`dd if=/dev/zero of="${scDir}/lifestyle/stub_b.mp3" bs=800 count=1 status=none`);
      await ssh.exec(`dd if=/dev/zero of="${scDir}/sfx/stub_c.wav" bs=100 count=1 status=none`);
      await ssh.exec(`dd if=/dev/zero of="${scDir}/sfx/stub_d.wav" bs=200 count=1 status=none`);
      await ssh.exec(`dd if=/dev/zero of="${scDir}/sfx/stub_e.wav" bs=300 count=1 status=none`);
      const res = await ssh.exec(`bash ${VALIDATOR_REMOTE} --target "${scDir}" --json`);
      let j = {};
      try { j = JSON.parse(res.stdout); } catch (e) {}
      recordTest(
        'Boundary Test 15: Multiple stubs across multiple categories correctly tallied and rejected',
        res.code !== 0 && j.corrupt_or_stub_files === 5 && j.categories?.lifestyle?.stub_files === 2 && j.categories?.sfx?.stub_files === 3,
        `Total stubs: ${j.corrupt_or_stub_files}, Lifestyle stubs: ${j.categories?.lifestyle?.stub_files}, Sfx stubs: ${j.categories?.sfx?.stub_files}`,
        { res }
      );
    }

    // Case 16: Human-readable CLI formatting vs JSON flag
    {
      const scDir = `${SANDBOX_BASE}/scenario_200_files`;
      const resHuman = await ssh.exec(`bash ${VALIDATOR_REMOTE} --target "${scDir}"`);
      const resJson = await ssh.exec(`bash ${VALIDATOR_REMOTE} --target "${scDir}" --json`);
      let parsed = false;
      try {
        JSON.parse(resJson.stdout);
        parsed = true;
      } catch (e) {}
      recordTest(
        'Boundary Test 16: Human-readable report formatting and strict parseable JSON output parity',
        resHuman.code === 0 && resJson.code === 0 && parsed === true && resHuman.stdout.includes('Overall Acceptance Gate : [ PASS ]'),
        `Human exit: ${resHuman.code}, JSON exit: ${resJson.code}, JSON parseable: ${parsed}`,
        { resHuman, resJson }
      );
    }

    // Case 17: CLI arguments override flags (--min-files, --min-size)
    {
      const scDir = await setupScenario('scenario_custom_thresholds');
      for (const c of categories) {
        await createAudioFiles(`${scDir}/${c}`, 2, 'small', 1000, 'mp3');
      }
      const resCustomPass = await ssh.exec(`bash ${VALIDATOR_REMOTE} --target "${scDir}" --min-files 10 --min-size 500 --json`);
      let jPass = {};
      try { jPass = JSON.parse(resCustomPass.stdout); } catch (e) {}

      const resCustomFail = await ssh.exec(`bash ${VALIDATOR_REMOTE} --target "${scDir}" --min-files 10 --min-size 2000 --json`);
      let jFail = {};
      try { jFail = JSON.parse(resCustomFail.stdout); } catch (e) {}

      recordTest(
        'Boundary Test 17: CLI arguments override (--min-files and --min-size) dynamically alter validation thresholds',
        resCustomPass.code === 0 && jPass.status === 'PASS' && resCustomFail.code !== 0 && jFail.status === 'FAIL',
        `Pass scenario exit: ${resCustomPass.code}, Fail scenario exit: ${resCustomFail.code}`,
        { jPass, jFail }
      );
    }

    // CLEANUP SANDBOX
    await ssh.exec(`rm -rf ${SANDBOX_BASE}`);
    console.log(`\n✓ Sandbox cleaned up: ${SANDBOX_BASE}`);

  } finally {
    ssh.close();
  }

  console.log('\n================================================================================');
  console.log('                          CHALLENGER 1 AUDIT SUMMARY                            ');
  console.log('================================================================================');
  const total = testResults.length;
  const passed = testResults.filter(t => t.passed).length;
  const failed = total - passed;
  console.log(`TOTAL CHALLENGE TESTS: ${total}`);
  console.log(`PASSED               : ${passed}`);
  console.log(`FAILED               : ${failed}`);
  console.log(`VERDICT              : ${failed === 0 ? 'APPROVE' : 'REJECT'}`);
  console.log('================================================================================\n');

  return { total, passed, failed, results: testResults };
}

runChallengerStressTest().catch(err => {
  console.error('FATAL CHALLENGER ERROR:', err);
  process.exit(1);
});

