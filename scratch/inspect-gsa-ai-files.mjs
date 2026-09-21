import { runSshScript } from './ssh2-run.mjs';

const script = `
echo "=== FILES IN /home/opc/gsa-ai/ ==="
find /home/opc/gsa-ai/ -maxdepth 1 -type f -exec ls -la {} +

echo "=== DOCKERFILE CONTENT ==="
cat /home/opc/gsa-ai/Dockerfile

echo "=== ENTRYPOINT OR START FILES ==="
find /home/opc/gsa-ai/ -name "*.sh" -exec ls -la {} +
`;

const res = await runSshScript(script);
console.log(res.stdout);
