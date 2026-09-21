import { runSshScript } from './ssh2-run.mjs';
const result=await runSshScript(`ps -eo pid,etimes,cmd | grep -E '[a]nalyze-source-jumps|[f]fmpeg.*gsa-news-2026-09-01-broadcast-v4-final' || true`,20000);process.stdout.write(result.stdout||'');
