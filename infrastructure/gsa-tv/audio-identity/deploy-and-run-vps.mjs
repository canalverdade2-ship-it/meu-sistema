#!/usr/bin/env node
// ==============================================================================
// GSA TV — Audio Identity VPS Remote Deployer and Pipeline Runner
// Path: infrastructure/gsa-tv/audio-identity/deploy-and-run-vps.mjs
// Target: Deploy to 147.15.43.141 (~/teamwork_projects/audio_identity_builder)
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'ssh2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VPS_HOST = '147.15.43.141';
const VPS_USER = 'opc';
const VPS_KEY_PATH = 'C:/Users/Adriano Farias/Downloads/CLOUD/ssh-key-2026-07-30.key';
const REMOTE_PROJECT_DIR = '/home/opc/teamwork_projects/audio_identity_builder';
const REMOTE_AUDIO_DIR = '/opt/gsa-tv/cache/media/1/identity/audio';

console.log('================================================================================');
console.log('         GSA-TV AUDIO IDENTITY — VPS DEPLOYMENT & EXECUTION RUNNER             ');
console.log('================================================================================');
console.log(`Remote Host    : ${VPS_HOST} (user: ${VPS_USER})`);
console.log(`SSH Key Path   : ${VPS_KEY_PATH}`);
console.log(`Remote Workdir : ${REMOTE_PROJECT_DIR}`);
console.log(`Target Cache   : ${REMOTE_AUDIO_DIR}`);
console.log(`Local Source   : ${__dirname}`);

if (!fs.existsSync(VPS_KEY_PATH)) {
  console.error(`ERROR: SSH private key not found at ${VPS_KEY_PATH}`);
  process.exit(1);
}

const privateKey = fs.readFileSync(VPS_KEY_PATH);

// Helper to execute SSH commands with streaming output
function executeSshCommand(conn, cmd, timeoutMs = 600000) {
  return new Promise((resolve, reject) => {
    let timer = null;
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        reject(new Error(`Command timed out after ${timeoutMs}ms: ${cmd.slice(0, 80)}`));
      }, timeoutMs);
    }

    conn.exec(cmd, (err, stream) => {
      if (err) {
        if (timer) clearTimeout(timer);
        return reject(err);
      }

      let stdout = '';
      let stderr = '';

      stream.on('data', (chunk) => {
        const text = chunk.toString();
        stdout += text;
        process.stdout.write(text);
      });

      stream.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        stderr += text;
        process.stderr.write(text);
      });

      stream.on('close', (code) => {
        if (timer) clearTimeout(timer);
        if (code !== 0) {
          const error = new Error(`Command exited with code ${code}`);
          error.code = code;
          error.stdout = stdout;
          error.stderr = stderr;
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  });
}

// Helper to transfer file via base64 encoded stream
async function transferFile(conn, localPath, remotePath) {
  const content = fs.readFileSync(localPath);
  const b64 = content.toString('base64');
  const filename = path.basename(localPath);
  console.log(`Transferring ${filename} (${content.length} bytes)...`);

  // Write via base64 decode on remote
  const cmd = `mkdir -p "$(dirname "${remotePath}")" && cat << 'EOF_B64' | base64 -d > "${remotePath}"\n${b64}\nEOF_B64\nchmod +x "${remotePath}"`;
  await executeSshCommand(conn, cmd, 30000);
}

async function main() {
  const conn = new Client();

  await new Promise((resolve, reject) => {
    conn.on('ready', resolve);
    conn.on('error', reject);
    conn.connect({
      host: VPS_HOST,
      port: 22,
      username: VPS_USER,
      privateKey,
      readyTimeout: 30000
    });
  });

  console.log('>>> [1/5] SSH Connection Established successfully.');

  try {
    // 1. Prepare remote directories
    console.log(`\n>>> [2/5] Preparing remote directories...`);
    await executeSshCommand(conn, `mkdir -p "${REMOTE_PROJECT_DIR}" "${REMOTE_AUDIO_DIR}"`);

    // 2. Transfer all pipeline scripts
    console.log(`\n>>> [3/5] Deploying scripts to ${REMOTE_PROJECT_DIR}...`);
    const filesToDeploy = [
      'ensure-dependencies.sh',
      'acquire_identity_audio.mjs',
      'run-audio-identity-pipeline.sh',
      'ATTRIBUTIONS.md'
    ];

    // Check if test writer scripts exist locally and sync them as well
    for (const optionalTestScript of ['validate-audio-inventory.sh', 'verify-audio-samples.sh']) {
      const fullPath = path.join(__dirname, optionalTestScript);
      if (fs.existsSync(fullPath)) {
        filesToDeploy.push(optionalTestScript);
      }
    }

    for (const file of filesToDeploy) {
      const localFile = path.join(__dirname, file);
      const remoteFile = `${REMOTE_PROJECT_DIR}/${file}`;
      await transferFile(conn, localFile, remoteFile);
    }

    // 3. Execute pipeline on remote VPS
    console.log(`\n>>> [4/5] Executing Sonic Identity Pipeline on VPS...`);
    const runPipelineCmd = `cd "${REMOTE_PROJECT_DIR}" && bash run-audio-identity-pipeline.sh`;
    await executeSshCommand(conn, runPipelineCmd, 900000); // 15 min timeout

    // 4. Verification of Live VPS Assets
    console.log(`\n>>> [5/5] Performing Remote Acceptance Verification on VPS...`);
    const verifyScript = `
echo "================================================================================"
echo "          LIVE VPS ASSET VERIFICATION: ${REMOTE_AUDIO_DIR}"
echo "================================================================================"
TOTAL_COUNT=$(find "${REMOTE_AUDIO_DIR}" -type f \\( -iname "*.mp3" -o -iname "*.wav" -o -iname "*.m4a" \\) | wc -l)
echo "Total Audio Files Found: $TOTAL_COUNT"

ALL_OK=true
for cat in news viral faith lifestyle sfx; do
  CAT_COUNT=$(find "${REMOTE_AUDIO_DIR}/$cat" -maxdepth 1 -type f \\( -iname "*.mp3" -o -iname "*.wav" -o -iname "*.m4a" \\) | wc -l)
  echo "  Category [$cat]: $CAT_COUNT files"
  if [ "$CAT_COUNT" -lt 30 ]; then
    echo "  [FAIL] Category $cat has too few files: $CAT_COUNT"
    ALL_OK=false
  fi
done

# Check for corrupt stubs < 4KB
STUB_COUNT=0
while IFS= read -r f; do
  SZ=$(stat -c%s "$f" 2>/dev/null || echo 0)
  if [ "$SZ" -lt 4096 ]; then
    echo "  [STUB DETECTED] $f ($SZ bytes)"
    STUB_COUNT=$((STUB_COUNT + 1))
  fi
done < <(find "${REMOTE_AUDIO_DIR}" -type f \\( -iname "*.mp3" -o -iname "*.wav" -o -iname "*.m4a" \\))

echo "Corrupt/Stub Files (< 4KB): $STUB_COUNT"

if [ "$STUB_COUNT" -gt 0 ]; then
  ALL_OK=false
fi

if [ "$TOTAL_COUNT" -lt 200 ]; then
  echo "ERROR: Total count $TOTAL_COUNT is below 200 threshold!"
  ALL_OK=false
fi

# Run ffprobe sample check on 10 random files
echo ""
echo "Sampling 10 random audio files with ffprobe / file:"
find "${REMOTE_AUDIO_DIR}" -type f \\( -iname "*.mp3" -o -iname "*.wav" \\) | shuf -n 10 | while read -r sample; do
  echo "--- $(basename "$sample") ---"
  file -b "$sample"
  ffprobe -v error -show_entries format=duration,format_name -of json "$sample" 2>&1 || true
done

if [ "$ALL_OK" = true ]; then
  echo ""
  echo "================================================================================"
  echo "   ACCEPTANCE VERIFICATION PASSED: >= 200 VALID AUDIO ASSETS IN PRODUCTION!   "
  echo "================================================================================"
  exit 0
else
  echo ""
  echo "ACCEPTANCE VERIFICATION FAILED."
  exit 1
fi
`;

    await executeSshCommand(conn, verifyScript, 120000);

    console.log('\nDeployment and verification finished with complete SUCCESS.');
  } finally {
    conn.end();
  }
}

main().catch((err) => {
  console.error('\nFATAL ERROR in deploy-and-run-vps:', err);
  process.exit(1);
});
