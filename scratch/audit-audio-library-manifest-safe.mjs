import {runSshScript} from './ssh2-run.mjs';
const sh=String.raw`set -euo pipefail
root=/opt/gsa-tv/cache/media/1/identity/audio
echo '=== COUNTS ==='
for d in news viral faith lifestyle sfx; do printf '%s|' "$d"; find "$root/$d" -type f 2>/dev/null | wc -l; done
echo '=== MANIFESTS ==='
find "$root" -maxdepth 3 -type f \( -iname '*manifest*' -o -iname '*license*' -o -iname '*licence*' -o -iname '*attribution*' -o -iname '*.csv' -o -iname '*.json' \) -printf '%s|%p\n' | sort
echo '=== TOTAL ==='
du -sh "$root"
echo '=== MANIFEST HEADERS/SAMPLES ==='
while IFS= read -r f; do echo "--- $f"; sed -n '1,12p' "$f" 2>/dev/null || true; done < <(find "$root" -maxdepth 3 -type f \( -iname '*manifest*' -o -iname '*license*' -o -iname '*licence*' -o -iname '*attribution*' -o -iname '*.csv' -o -iname '*.json' \) | sort)
`;
const r=await runSshScript(sh,120000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
