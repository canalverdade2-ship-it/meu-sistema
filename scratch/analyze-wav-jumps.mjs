import fs from 'node:fs';

for (const file of process.argv.slice(2)) {
  const b = fs.readFileSync(file);
  let pos = 12;
  let channels = 0, rate = 0, bits = 0, dataStart = 0, dataSize = 0;
  while (pos + 8 <= b.length) {
    const id = b.toString('ascii', pos, pos + 4);
    const size = b.readUInt32LE(pos + 4);
    if (id === 'fmt ') {
      channels = b.readUInt16LE(pos + 10);
      rate = b.readUInt32LE(pos + 12);
      bits = b.readUInt16LE(pos + 22);
    }
    if (id === 'data') { dataStart = pos + 8; dataSize = Math.min(size, b.length - dataStart); break; }
    pos += 8 + size + (size & 1);
  }
  if (bits !== 24) throw new Error(`${file}: esperado PCM 24-bit, obtido ${bits}`);
  const bytesPerFrame = channels * 3;
  const frameCount = Math.floor(dataSize / bytesPerFrame);
  const prev = new Array(channels).fill(0);
  let maxAbs = 0, maxJump = 0, sumSq = 0, samples = 0;
  const counts = {gt010:0, gt015:0, gt018:0, gt020:0, gt025:0, gt030:0};
  const largest = [];
  const read24 = offset => {
    let n = b[offset] | (b[offset+1] << 8) | (b[offset+2] << 16);
    if (n & 0x800000) n |= 0xff000000;
    return n / 8388608;
  };
  for (let frame = 0; frame < frameCount; frame++) {
    for (let ch = 0; ch < channels; ch++) {
      const x = read24(dataStart + frame * bytesPerFrame + ch * 3);
      const jump = Math.abs(x - prev[ch]);
      prev[ch] = x; samples++; sumSq += x*x;
      if (Math.abs(x) > maxAbs) maxAbs = Math.abs(x);
      if (jump > maxJump) maxJump = jump;
      if (jump > .10) counts.gt010++;
      if (jump > .15) counts.gt015++;
      if (jump > .18) counts.gt018++;
      if (jump > .20) counts.gt020++;
      if (jump > .25) counts.gt025++;
      if (jump > .30) counts.gt030++;
      if (jump > .15) {
        largest.push({jump, time:frame/rate, ch});
        largest.sort((a,c)=>c.jump-a.jump);
        if (largest.length > 20) largest.length = 20;
      }
    }
  }
  console.log(JSON.stringify({file,channels,rate,bits,duration:frameCount/rate,frames:frameCount,maxAbs,maxJump,rms:Math.sqrt(sumSq/samples),counts,largest},null,2));
}
