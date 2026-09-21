import fs from 'node:fs';

const html = fs.readFileSync(new URL('./youtube-current-page.html', import.meta.url), 'utf8');
const marker = 'var ytInitialPlayerResponse = ';
const start = html.indexOf(marker);
if (start < 0) throw new Error('ytInitialPlayerResponse ausente');
const jsonStart = html.indexOf('{', start + marker.length);
let depth = 0;
let inString = false;
let escaped = false;
let end = -1;
for (let i = jsonStart; i < html.length; i++) {
  const ch = html[i];
  if (inString) {
    if (escaped) escaped = false;
    else if (ch === '\\') escaped = true;
    else if (ch === '"') inString = false;
    continue;
  }
  if (ch === '"') inString = true;
  else if (ch === '{') depth++;
  else if (ch === '}' && --depth === 0) { end = i + 1; break; }
}
if (end < 0) throw new Error('JSON incompleto');
const response = JSON.parse(html.slice(jsonStart, end));
const formats = response.streamingData?.adaptiveFormats || [];
const audio = formats
  .filter(x => x.mimeType?.startsWith('audio/') && x.url)
  .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
if (!audio.length) throw new Error('URL de áudio ausente');
fs.writeFileSync(new URL('./youtube-live-audio-url.txt', import.meta.url), audio[0].url, 'utf8');
console.log(JSON.stringify({
  status: response.playabilityStatus?.status,
  videoId: response.videoDetails?.videoId,
  title: response.videoDetails?.title,
  isLive: response.videoDetails?.isLive,
  selected: {itag:audio[0].itag, mimeType:audio[0].mimeType, bitrate:audio[0].bitrate, sampleRate:audio[0].audioSampleRate, channels:audio[0].audioChannels},
  audioFormats: audio.map(x => ({itag:x.itag, mimeType:x.mimeType, bitrate:x.bitrate, sampleRate:x.audioSampleRate, channels:x.audioChannels}))
}, null, 2));
