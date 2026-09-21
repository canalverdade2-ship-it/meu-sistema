import { runSshScript } from './ssh2-run.mjs';
const result=await runSshScript(`command -v fpcalc || true; ffmpeg -filters 2>/dev/null | grep -E 'axcorrelate|apsnr|asisdr' || true`,20000);process.stdout.write(result.stdout||'');
