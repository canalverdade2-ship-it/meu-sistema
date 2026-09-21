import {runSshScript} from './ssh2-run.mjs';
const sh=String.raw`set -euo pipefail
root=/opt/gsa-tv/cache/media/1/identity/audio
echo '=== ATTRIBUTIONS ==='
cat "$root/ATTRIBUTIONS.md"
echo '=== LICENSE COUNTS ==='
python3 - <<'PY'
import json,collections
p='/opt/gsa-tv/cache/media/1/identity/audio/manifest.json'
d=json.load(open(p,encoding='utf-8'))
print('entries',len(d))
print('licenses',dict(collections.Counter(x.get('license') for x in d)))
print('authors',dict(collections.Counter(x.get('author') for x in d)))
print('missing_source',sum(not x.get('source_url') for x in d))
print('missing_sha',sum(not x.get('sha256') for x in d))
PY
`;
const r=await runSshScript(sh,120000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
