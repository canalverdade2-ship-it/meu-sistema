import {runSshScript} from './ssh2-run.mjs';
const remote=String.raw`set -e
root=/opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01-v2
echo 'WORK'; sudo find "$root/work" -maxdepth 1 -type f -printf '%f|%s\n' | sort
echo 'IMAGES'; sudo find "$root/images" -maxdepth 1 -type f -printf '%f|%s\n' | sort
echo 'AUDIO'; sudo find "$root/audio" -maxdepth 1 -type f -printf '%f|%s\n' | sort
echo 'VIDEO'; sudo find "$root/video" -maxdepth 1 -type f -printf '%f|%s\n' | sort
`;
const r=await runSshScript(remote,30000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
