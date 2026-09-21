import { runSshScript } from './ssh2-run.mjs';

const expression = `(() => {
  const v = document.querySelector('video');
  const p = document.querySelector('#movie_player');
  let r = null;
  try { r = p?.getPlayerResponse?.() || window.ytInitialPlayerResponse || null; } catch {}
  return {
    url: location.href,
    title: document.title,
    body: (document.body?.innerText || '').slice(0, 1200),
    video: v ? {readyState:v.readyState, paused:v.paused, currentTime:v.currentTime, duration:v.duration, networkState:v.networkState, error:v.error?.message||null, src:v.currentSrc} : null,
    playability: r?.playabilityStatus || null,
    videoDetails: r?.videoDetails ? {videoId:r.videoDetails.videoId, title:r.videoDetails.title, isLive:r.videoDetails.isLive, isLiveContent:r.videoDetails.isLiveContent} : null,
    audio: (r?.streamingData?.adaptiveFormats || []).filter(x => x.mimeType?.startsWith('audio/')).map(x => ({itag:x.itag, mimeType:x.mimeType, bitrate:x.bitrate, url:x.url||null, signatureCipher:!!x.signatureCipher})),
    hls: r?.streamingData?.hlsManifestUrl || null
  };
})()`;

const remoteJs = `
(async () => {
  const tabs = await (await fetch('http://127.0.0.1:9228/json/list')).json();
  const tab = tabs.find(x => x.type === 'page' && x.url.includes('youtube.com/watch'));
  if (!tab) throw new Error('watch tab not found');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  let seq = 1;
  const call = (method, params = {}) => new Promise((ok, no) => {
    const id = seq++;
    const handler = e => {
      const m = JSON.parse(e.data);
      if (m.id === id) {
        ws.removeEventListener('message', handler);
        m.error ? no(new Error(JSON.stringify(m.error))) : ok(m.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({id, method, params}));
  });
  const res = await call('Runtime.evaluate', {expression:${JSON.stringify(expression)}, returnByValue:true, awaitPromise:true});
  console.log(JSON.stringify(res.result.value, null, 2));
  ws.close();
  process.exit(0);
})().catch(e => { console.error(e.stack || e); process.exit(1); });
`;

const encoded = Buffer.from(remoteJs).toString('base64');
const result = await runSshScript(`printf '%s' '${encoded}' | base64 -d > /tmp/cdp-evaluate.js
timeout 20s node /tmp/cdp-evaluate.js
rm -f /tmp/cdp-evaluate.js`, 30000);
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
