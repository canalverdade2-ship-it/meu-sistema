import { runSshScript } from './ssh2-run.mjs';

const script = `
python3 -c "
import os, glob, time
files = sorted(glob.glob('/opt/gsa-tv/runtime/hls/program_*.ts'), key=os.path.getmtime)
for f in files:
    print(f, os.path.getmtime(f), time.ctime(os.path.getmtime(f)))
if len(files) >= 2:
    dt = os.path.getmtime(files[-1]) - os.path.getmtime(files[0])
    count = len(files) - 1
    fps = (count * 60.0) / dt if dt > 0 else 30.0
    print(f'Count: {count} segments, dt: {dt:.2f}s, Calculated FPS: {fps:.2f}')
"
`;

const res = await runSshScript(script);
console.log(res.stdout);
