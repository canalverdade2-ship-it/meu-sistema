import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
git --git-dir=/opt/gsa-tv/control-plane/.git log -n 5 --oneline 2>/dev/null || grep -rn "rtmp://a.rtmp.youtube.com" /opt/gsa-tv/control-plane/src/*.before* 2>/dev/null | head -10
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
