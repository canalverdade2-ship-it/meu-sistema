import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo grep -rn "gsa-tv" /etc/nginx/conf.d/ /etc/nginx/nginx.conf
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
