import http from 'node:http';
import fs from 'node:fs';
const file = new URL('./qc-v2/logos/gsa-mercado.png', import.meta.url);
http.createServer((req,res)=>{
  if (req.url === '/gsa-mercado.png') {
    res.setHeader('Content-Type','image/png');
    res.end(fs.readFileSync(file));
    return;
  }
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.end('<!doctype html><title>Logo oficial GSA Mercado</title><img src="/gsa-mercado.png" alt="Logo oficial GSA Mercado">');
}).listen(8767,'127.0.0.1');
