import fs from 'node:fs';
const files=process.argv.slice(2);
for(const p of files){
  const s=fs.readFileSync(p,'utf8');
  const lines=s.split(/\r?\n/);
  const bad=[];
  lines.forEach((line,i)=>{if(/[ÃÂâï�]/.test(line)) bad.push(`${i+1}: ${line.trim().slice(0,220)}`);});
  console.log(`=== ${p} | bad=${bad.length} ===`);
  console.log(bad.slice(0,120).join('\n'));
}
