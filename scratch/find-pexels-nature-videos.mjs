import { runSshScript } from './ssh2-run.mjs';
const script=String.raw`set -euo pipefail
for q in 'forest waterfall' 'ocean waves' 'mountain sunrise' 'tropical nature'; do
  echo "query|$q"
  curl -fsSL --max-time 25 -A 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' "https://www.pexels.com/search/videos/$(printf '%s' "$q"|sed 's/ /%20/g')/" |
    grep -oE 'https://[^" ]+video-files[^" ]+\.mp4[^" ]*' | sed 's/&amp;/\&/g' | head -3 || true
done
`;
const result=await runSshScript(script,120000);process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
