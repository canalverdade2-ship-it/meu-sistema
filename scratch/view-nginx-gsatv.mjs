import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo sed -n '195,240p' /etc/nginx/nginx.conf
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
