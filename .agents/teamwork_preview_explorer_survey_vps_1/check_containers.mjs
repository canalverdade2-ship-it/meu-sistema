import { runSshScript } from '../../scratch/ssh2-run.mjs';

async function check() {
  const script = `
echo '=== RUNNING CONTAINERS ==='
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"

echo '=== GSA-TV DOCKER VOLUMES / MOUNTS ==='
docker inspect gsa-tv-ffplayout --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}' 2>/dev/null || echo "gsa-tv-ffplayout inspect failed"
docker inspect gsa-tv-control-plane --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}' 2>/dev/null || echo "gsa-tv-control-plane inspect failed"
`;
  const res = await runSshScript(script, 15000);
  console.log(res.stdout);
}

check().catch(console.error);
