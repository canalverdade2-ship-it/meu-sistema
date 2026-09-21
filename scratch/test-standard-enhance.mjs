import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker exec -i gsa-tv-control-plane node -e '
const http = require("http");

const payload = JSON.stringify({ profile: "standard", remove_watermark: true });
const req = http.request({
  hostname: "127.0.0.1",
  port: 9202,
  path: "/media/media-vinheta-gsa-news/enhance",
  method: "POST",
  headers: {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
    "authorization": "Bearer dev_token_for_cron"
  }
}, (res) => {
  let data = "";
  res.on("data", chunk => data += chunk);
  res.on("end", () => console.log("Status:", res.statusCode, "Response:", data));
});

req.on("error", (e) => console.error(e));
req.write(payload);
req.end();
'
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(console.error);
