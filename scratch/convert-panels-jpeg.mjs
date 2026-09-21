import fs from 'node:fs';import path from 'node:path';import sharp from 'file:///C:/Users/Adriano%20Farias/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.cjs';
const root=path.resolve('scratch/qc-v2/panels');
for(const f of fs.readdirSync(root).filter(x=>x.endsWith('.png'))){const out=path.join(root,f.replace('.png','.jpg'));await sharp(path.join(root,f)).flatten({background:'#071227'}).jpeg({quality:92,chromaSubsampling:'4:4:4'}).toFile(out);console.log(path.basename(out),fs.statSync(out).size)}
