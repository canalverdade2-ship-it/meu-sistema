import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
python3 -c "
import urllib.request, json, re

for vid in ['RqX4IJXdbGQ', 'g-Kbyx_zG-Y']:
    url = f'https://www.youtube.com/watch?v={vid}'
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        html = urllib.request.urlopen(req).read().decode('utf-8')
        m_title = re.search(r'\"title\":\"([^\"]+)\"', html)
        m_live = re.search(r'\"isLive\":(true|false)', html)
        m_status = re.search(r'\"status\":\"([^\"]+)\"', html)
        print(f'{vid} -> Title: {m_title.group(1) if m_title else \"?\"} | Live: {m_live.group(1) if m_live else \"?\"} | Status: {m_status.group(1) if m_status else \"?\"}')
    except Exception as e:
        print(f'{vid} -> Error: {e}')
"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
