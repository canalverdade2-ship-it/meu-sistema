import {runSshScript} from './ssh2-run.mjs';
const py=String.raw`import asyncio,json,re,pathlib
root=pathlib.Path('/opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01-v2')
m=json.loads((root/'work/manifest.json').read_text(encoding='utf-8'))
import edge_tts
async def main():
  for seg in [x for x in m['segments'] if x['anchor']=='duo']:
    d=root/'work'/f"duo-{seg['id']}"; d.mkdir(parents=True,exist_ok=True)
    parts=[p.strip() for p in re.split(r'(?<=[.!?])\s+',seg['script']) if p.strip()]
    files=[]
    for i,text in enumerate(parts):
      f=d/f'{i:03}.mp3'; await edge_tts.Communicate(text=text,voice='pt-BR-FranciscaNeural' if i%2==0 else 'pt-BR-AntonioNeural',rate='-4%').save(str(f)); files.append(f)
    (d/'concat.txt').write_text(''.join("file '"+str(f).replace('/opt/gsa-tv/cache/media','/media')+"'\n" for f in files),encoding='utf-8')
    print(seg['id'],len(files),flush=True)
asyncio.run(main())
`;
const enc=Buffer.from(py).toString('base64');
const remote=String.raw`set -euo pipefail
printf '%s' '${enc}' | base64 -d | sudo tee /tmp/gsa-news-duo.py >/dev/null
sudo env PATH="/tmp/gsa-news-edge-venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" /tmp/gsa-news-edge-venv/bin/python /tmp/gsa-news-duo.py
for id in escalada encerramento; do
  sudo docker run --rm --user 0 -v /opt/gsa-tv/cache/media:/media gsa-tv/control-plane:1.6.13 ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i "/media/1/news/gsa-news-2026-09-01-v2/work/duo-$id/concat.txt" -ar 48000 -ac 2 -c:a pcm_s16le "/media/1/news/gsa-news-2026-09-01-v2/audio/$id.wav"
done
sudo chown -R 989:986 /opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01-v2/audio /opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01-v2/work
`;
const r=await runSshScript(remote,900000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
