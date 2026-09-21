import { runSshScript } from './ssh2-run.mjs';

const script = `
python3 -c "
import urllib.request, json, time, re

def get_seq():
    with open('/opt/gsa-tv/runtime/hls/program.m3u8') as f:
        m = re.search(r'#EXT-X-MEDIA-SEQUENCE:(\\\\d+)', f.read())
        return int(m.group(1))

s1 = get_seq()
t1 = time.time()
print(f'Start seq: {s1} at {t1}')
time.sleep(20)
s2 = get_seq()
t2 = time.time()
dt = t2 - t1
dseq = s2 - s1
fps = (dseq * 60.0) / dt
print(f'End seq: {s2} at {t2}')
print(f'Elapsed: {dt:.2f}s, Segments produced: {dseq}, FPS: {fps:.2f} fps')
"
`;

const res = await runSshScript(script);
console.log(res.stdout);
