import { runSshScript } from '../../scratch/ssh2-run.mjs';

async function main() {
  const script = `
ls -lh /tmp/gsa_assemble_gsa-agro_1789443012/core_assembled.mp4 2>/dev/null
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
