set -e
node <<'JS'
const fs=require('fs');const p='/home/opc/gsa-upload-service/server.cjs';let s=fs.readFileSync(p,'utf8');
const marker="  if (url.pathname === '/health') {";
if(!s.includes(marker))throw Error('Unexpected source');
fs.copyFileSync(p,p+'.before-private-read-20260913',fs.constants.COPYFILE_EXCL);
s=s.replace(marker,`  if (url.pathname.startsWith('/uploads/private/') && ['GET', 'HEAD'].includes(req.method)) {
    return require('./private-files.cjs').createPrivateHandler({ root: UPLOAD_DIR, psql })(req, res, url.pathname);
  }

`+marker);
fs.writeFileSync(p,s);
JS
node --check /home/opc/gsa-upload-service/server.cjs
node --check /home/opc/gsa-upload-service/private-files.cjs
pm2 restart gsa-upload >/dev/null
