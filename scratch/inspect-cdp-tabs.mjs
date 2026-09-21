import { runSshScript } from './ssh2-run.mjs';

const script = `
echo "=== PROCESSES IN GSA-AI-BROWSER ==="
sudo docker top gsa-ai-browser

echo "=== CDP TABS LIST ==="
curl -s http://127.0.0.1:9228/json/list | jq -r '.[] | "\\(.id) \\(.type) \\(.url)"'
`;

const res = await runSshScript(script);
console.log(res.stdout);
