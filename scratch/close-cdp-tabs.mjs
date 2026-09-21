import { runSshScript } from './ssh2-run.mjs';

const script = `
echo "=== CLOSING ORPHAN TABS VIA CDP ==="
curl -s http://127.0.0.1:9228/json/list | jq -c '.[]' | while read -r target; do
  t_id=$(echo "$target" | jq -r '.id')
  t_type=$(echo "$target" | jq -r '.type')
  t_url=$(echo "$target" | jq -r '.url')
  if [ "$t_type" = "page" ]; then
    echo "Closing page $t_id: $t_url"
    curl -s "http://127.0.0.1:9228/json/close/$t_id" || true
    echo ""
  fi
done

echo "=== CHECK REMAINING TABS ==="
curl -s http://127.0.0.1:9228/json/list | jq -r '.[] | "\\(.id) \\(.type) \\(.url)"'
`;

const res = await runSshScript(script);
console.log(res.stdout);
if (res.stderr) console.error("STDERR:", res.stderr);
