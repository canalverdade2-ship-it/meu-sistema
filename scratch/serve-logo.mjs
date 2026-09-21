import http from 'node:http';
import fs from 'node:fs';
const file = new URL('./qc-v2/logos/gsa-mercado.png', import.meta.url);
http.createServer((req,res)=>{
  res.setHeader('Content-Type','image/png');
  res.end(fs.readFileSync(file));
}).listen(8766,'127.0.0.1');
