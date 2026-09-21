import { runSshScript } from './ssh2-run.mjs';

const script = `
python3 -c "
import time, os, re

def get_seq():
    with open('/opt/gsa-tv/runtime/hls/program.m3u8') as f:
        m = re.search(r'#EXT-X-MEDIA-SEQUENCE:(\\\\d+)', f.read())
        return int(m.group(1))

last_s = get_seq()
last_t = time.time()
print(f'Starting watch at seq {last_s}')

for i in range(15):
    time.sleep(2)
    s = get_seq()
    t = time.time()
    if s != last_s:
        dt = t - last_t
        ds = s - last_s
        print(f'New seq {s} (+{ds}) after {dt:.2f}s (dt/ds: {dt/ds:.2f}s per segment)')
        last_s = s
        last_t = t
"
`;

const res = await runSshScript(script);
console.log(res.stdout);
