import { runSshScript } from './ssh2-run.mjs';
import fs from 'fs';

async function main() {
  try {
    const bashContent = fs.readFileSync('scratch/run_v2.sh', 'utf8');
    
    // We send it via stdin to cat
    const uploadScript = `
cat << 'END_OF_SCRIPT' > /tmp/run_v2.sh
${bashContent}
END_OF_SCRIPT
chmod +x /tmp/run_v2.sh
sudo /tmp/run_v2.sh
    `;
    
    console.log("Starting SSH script...");
    const res = await runSshScript(uploadScript, 1800000); // 30 min
    console.log("Output:");
    console.log(res.stdout);
  } catch (err) {
    console.error("Error:");
    console.error(err);
  }
}

main();
