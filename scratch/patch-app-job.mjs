import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker exec gsa-tv-control-plane sed -i '/default:/i \\    case "ai_flow_vids_generate":\\n      log("info", "ai_flow_vids_generate_received", { payload: job.payload });\\n      return { accepted: true, pipeline: "google_flow_vids_vps", engine: "active", title: job.payload?.title || "Produção IA" };' /app/src/app.js
sudo docker exec gsa-tv-control-plane grep -C 5 "ai_flow_vids_generate" /app/src/app.js
sudo docker restart gsa-tv-control-plane
`;
  const res = await runSshScript(script);
  console.log('OUTPUT:\n', res.stdout, res.stderr);
}

main().catch(console.error);
