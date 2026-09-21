import fs from 'node:fs';
const files=[
'src/components/admin/GsaTvModule.tsx',
'src/components/admin/gsa-tv/GsaTvProgrammingStudio.tsx',
'infrastructure/gsa-tv/services/playout-api/src/app.js',
'infrastructure/gsa-tv/services/watchdog/src/app.js',
'scripts/check-gsa-tv-contracts.ts'
];
for(const f of files){
 const s=fs.readFileSync(f,'utf8'); const hits=[];
 for(const r of [/"[^"\n]*\?[^"\n]*"/g,/'[^'\n]*\?[^'\n]*'/g, /`[^`\n]*\?[^`\n]*`/g]) for(const m of s.matchAll(r)) hits.push(m[0]);
 console.log(`\n${f} (${hits.length})`); for(const x of [...new Set(hits)]) console.log(x);
}
