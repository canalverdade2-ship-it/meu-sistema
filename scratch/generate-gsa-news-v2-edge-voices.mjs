import {runSshScript} from './ssh2-run.mjs';
const py=String.raw`import asyncio,json,pathlib
root=pathlib.Path('/opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01-v2')
manifest=json.loads((root/'work/manifest.json').read_text(encoding='utf-8'))
import edge_tts
async def synth(text,voice,out):
    await edge_tts.Communicate(text=text,voice=voice,rate='-4%',pitch='+0Hz').save(str(out))
async def main():
    for seg in manifest['segments']:
        wav=root/'audio'/f"{seg['id']}.wav"
        if wav.exists() and wav.stat().st_size>100000: continue
        source=root/'audio'/f"{seg['id']}.mp3"
        await synth(seg['script'],'pt-BR-AntonioNeural' if seg['anchor']=='male' else 'pt-BR-FranciscaNeural',source)
        print('mp3',seg['id'],source.stat().st_size,flush=True)
asyncio.run(main())
`;
const encoded=Buffer.from(py).toString('base64');
const remote=String.raw`set -euo pipefail
python3 -m venv /tmp/gsa-news-edge-venv
/tmp/gsa-news-edge-venv/bin/pip install --quiet edge-tts==7.2.7
printf '%s' '${encoded}' | base64 -d | sudo tee /tmp/gsa-news-edge-voices.py >/dev/null
sudo env PATH="/tmp/gsa-news-edge-venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" /tmp/gsa-news-edge-venv/bin/python /tmp/gsa-news-edge-voices.py
for mp3 in /opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01-v2/audio/*.mp3; do
  [ -f "$mp3" ] || continue
  base=$(basename "$mp3" .mp3)
  wav="/opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01-v2/audio/$base.wav"
  sudo docker run --rm --user 0 -v /opt/gsa-tv/cache/media:/media gsa-tv/control-plane:1.6.13 ffmpeg -hide_banner -loglevel error -y -i "/media/1/news/gsa-news-2026-09-01-v2/audio/$base.mp3" -ar 48000 -ac 2 -c:a pcm_s16le "/media/1/news/gsa-news-2026-09-01-v2/audio/$base.wav"
done
sudo chown -R 989:986 /opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01-v2/audio /opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01-v2/work
`;
const r=await runSshScript(remote,1800000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
