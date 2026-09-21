const fs=require('fs');
const results=[];
for(const pid of fs.readdirSync('/proc').filter(x=>/^\d+$/.test(x))){
 try {
  if(fs.readFileSync(`/proc/${pid}/comm`,'utf8').trim()!=='ffmpeg')continue;
  const args=fs.readFileSync(`/proc/${pid}/cmdline`,'utf8').split('\0').filter(Boolean);
  const status=fs.readFileSync(`/proc/${pid}/status`,'utf8');
  const ppid=status.match(/^PPid:\s*(\d+)/m)?.[1];
  const parent=ppid?fs.readFileSync(`/proc/${ppid}/comm`,'utf8').trim():null;
  results.push({pid,ppid,parent,networkOutput:args.some(x=>/^rtmps?:|^srt:|^udp:/.test(x)),hls:args.includes('hls'),streamCopy:args.includes('copy'),nullOutput:args.includes('null'),loopsInput:args.includes('-stream_loop'),localMp4Output: /\.mp4$/.test(args.at(-1)||''),outputClass: /^(rtmps?|srt|udp):/.test(args.at(-1)||'')?'network': /\.mp4$/.test(args.at(-1)||'')?'mp4': /\.m3u8$/.test(args.at(-1)||'')?'hls':'other'});
 }catch{}
}
console.log(JSON.stringify(results));
