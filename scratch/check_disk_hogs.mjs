import { runSshScript } from './ssh2-run.mjs';

const cmd = `
echo "=== TOP USAGE IN /home/opc/ ==="
sudo du -sh /home/opc/gsa-ai/work/* 2>/dev/null | sort -hr | head -n 30
echo ""
echo "=== TOP USAGE IN /tmp/ ==="
sudo du -sh /tmp/* 2>/dev/null | sort -hr | head -n 20
echo ""
echo "=== TOP USAGE IN /var/log/ ==="
sudo du -sh /var/log/* 2>/dev/null | sort -hr | head -n 10
echo ""
echo "=== DOCKER DISK USAGE ==="
docker system df
echo ""
echo "=== TOP DIRECTORIES ON / ==="
sudo du -hx --max-depth=2 / 2>/dev/null | sort -hr | head -n 30
`;

const res = await runSshScript(cmd, 60000);
console.log(res.stdout);
if (res.stderr) console.error("STDERR:", res.stderr);
