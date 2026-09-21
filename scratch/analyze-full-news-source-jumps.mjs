import { runSshScript } from './ssh2-run.mjs';
const py=String.raw`import subprocess, struct, json
path='/opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01-broadcast-v4/video/gsa-news-2026-09-01-broadcast-v4-final.mp4'
p=subprocess.Popen(['ffmpeg','-hide_banner','-loglevel','error','-i',path,'-map','0:a:0','-f','f32le','-acodec','pcm_f32le','-ar','48000','-ac','2','-'],stdout=subprocess.PIPE)
prev=[0.0,0.0]; counts={'.10':0,'.15':0,'.18':0,'.20':0,'.25':0,'.30':0}; maxj=0.0; maxpos=0; samples=0
carry=b''
while True:
    chunk=p.stdout.read(1024*1024)
    if not chunk: break
    chunk=carry+chunk; usable=len(chunk)-(len(chunk)%8); carry=chunk[usable:]
    vals=struct.iter_unpack('<ff',chunk[:usable])
    for pair in vals:
        for ch,x in enumerate(pair):
            j=abs(x-prev[ch]); prev[ch]=x; samples+=1
            if j>maxj: maxj=j; maxpos=samples//2
            for k,t in [('.10',.10),('.15',.15),('.18',.18),('.20',.20),('.25',.25),('.30',.30)]:
                if j>t: counts[k]+=1
code=p.wait()
print(json.dumps({'exit':code,'duration_frames':samples//2,'duration_s':samples/2/48000,'max_jump':maxj,'max_jump_time_s':maxpos/48000,'counts':counts}))`;
const encoded=Buffer.from(py).toString('base64');
const result=await runSshScript(`printf '%s' '${encoded}' | base64 -d > /tmp/analyze-source-jumps.py
timeout 55s python3 /tmp/analyze-source-jumps.py
rm -f /tmp/analyze-source-jumps.py`,65000);
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
