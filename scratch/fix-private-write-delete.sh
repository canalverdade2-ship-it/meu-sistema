set -e
node <<'JS'
const fs=require('fs');const p='/home/opc/gsa-upload-service/server.cjs';let s=fs.readFileSync(p,'utf8');
fs.copyFileSync(p,p+'.before-private-write-20260913',fs.constants.COPYFILE_EXCL);
s=s.replaceAll("req.on('end', () => {", "req.on('end', async () => {");
const marker='        const fullFilePath = path.join(UPLOAD_DIR, targetPath);';
if(!s.includes(marker))throw Error('Upload marker absent');
s=s.replace(marker,`        if (targetPath.startsWith('private/')) {
          const { actorFor, mayRead } = require('./private-files.cjs');
          if (!mayRead(await actorFor(req, psql), targetPath)) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Arquivo não pertence ao usuário.' }));
            return;
          }
        }
`+marker);
s=s.replace('          url: publicUrl,','          url: targetPath.startsWith(\'private/\') ? null : publicUrl,');
s=s.replace('          isPrivate: false','          isPrivate: targetPath.startsWith(\'private/\')');
const start=s.indexOf('        for (const p of paths) {');const end=s.indexOf("        res.writeHead(200",start);
if(start<0||end<0)throw Error('Delete marker absent');
s=s.slice(0,start)+`        const { actorFor, mayRead } = require('./private-files.cjs');
        const actor = await actorFor(req, psql);
        const cleanPaths = paths.map(p => {
          if (typeof p !== 'string' || p.includes('\\\\') || p.includes('\\0') || p.split('/').some(part => part === '..' || part === '.')) throw Error('Caminho inválido.');
          return p.replace(/^\\/+/, '').replace(/^public\\//, '');
        });
        if (cleanPaths.some(key => key.startsWith('private/') && !mayRead(actor, key))) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Arquivo não pertence ao usuário.' }));
          return;
        }
        for (const clean of cleanPaths) {
          const fp = path.join(UPLOAD_DIR, clean);
          if (fs.existsSync(fp)) fs.unlinkSync(fp);
        }
`+s.slice(end);
fs.writeFileSync(p,s);
JS
node --check /home/opc/gsa-upload-service/server.cjs
pm2 restart gsa-upload >/dev/null
