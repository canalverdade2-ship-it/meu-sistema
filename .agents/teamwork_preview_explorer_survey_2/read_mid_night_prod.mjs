import { runSshScript } from '../../scratch/ssh2-run.mjs';

async function main() {
  const script = `
sudo sed -n '80,180p' /opt/gsa-tv/bin/night-production.py
`;

  try {
    const res = await runSshScript(script);
    console.log(res.stdout);
    if (res.stderr) console.error("STDERR:", res.stderr);
  } catch (err) {
    console.error("ERROR:", err);
  }
}

main();
