import fs from 'node:fs';
const p='C:/Users/Adriano Farias/.codex/sessions/2026/08/17/rollout-2026-08-17T16-18-10-01a01128-ed98-7c82-b207-1afeb589b650.jsonl';
const L=fs.readFileSync(p,'utf8').trim().split(/\r?\n/);
function redact(value){
 let s=String(value);
 s=s.replace(/(password|passwd|token|secret|api[_-]?key|stream[_-]?key|authorization)(\s*[=:]\s*|"\s*:\s*")[^\s"']+/ig,'$1$2<redacted>');
 s=s.replace(/rtmps?:\/\/[^\s"']+/ig,'rtmp://<redacted>');
 return s;
}
for(let i=4688;i<L.length;i++){
 let j;try{j=JSON.parse(L[i])}catch{continue}
 const a=j.payload||{};
 if(a.type==='custom_tool_call') console.log(`\n### ${i} CALL ${a.name||''}\n`+redact(JSON.stringify(a,null,2)).slice(0,9000));
 if(a.type==='custom_tool_call_output') console.log(`\n### ${i} OUT\n`+redact(JSON.stringify(a,null,2)).slice(0,14000));
}
