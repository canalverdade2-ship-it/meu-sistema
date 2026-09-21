import fs from 'node:fs';
import { Client } from 'ssh2';

export function readInfraKey() {
  const creds = fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md', import.meta.url), 'utf8');
  const keyPath = creds.match(/Chave Privada:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
  if (!keyPath) throw new Error('Chave privada de infraestrutura não encontrada.');
  return fs.readFileSync(keyPath);
}

export function runSshScript(script, timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    const timer = setTimeout(() => { conn.end(); reject(new Error('SSH timeout.')); }, timeoutMs);
    conn.on('ready', () => conn.exec('bash -s', (error, stream) => {
      if (error) { clearTimeout(timer); conn.end(); return reject(error); }
      let stdout = '', stderr = '';
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
      stream.on('close', (code) => {
        clearTimeout(timer); conn.end();
        if (code !== 0) reject(Object.assign(new Error(stderr || stdout || `SSH exit ${code}`), { code, stdout, stderr }));
        else resolve({ stdout, stderr });
      });
      stream.end(script);
    }));
    conn.on('error', (error) => { clearTimeout(timer); reject(error); });
    conn.connect({ host: '147.15.43.141', port: 22, username: 'opc', privateKey: readInfraKey(), readyTimeout: 15000 });
  });
}
