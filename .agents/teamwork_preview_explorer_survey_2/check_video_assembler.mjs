import { runSshScript } from '../../scratch/ssh2-run.mjs';

async function main() {
  const script = `
echo "=== VIDEO ASSEMBLER CODE SUMMARY ==="
grep -n -E "print|ffmpeg|broll|bumper" /home/opc/gsa-program-builder/video_assembler.py | head -40
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
