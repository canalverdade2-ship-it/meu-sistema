import { runSshScript } from './ssh2-run.mjs';
import fs from 'fs';

const QC_DIR = '/home/opc/gsa-ai/work/identity-flow-20260907/qc-regen';
const LOCAL_DIR = './scratch/qc';
if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });

const files = [
  'gsa-business-opening-qc.jpg',
  'gsa-news-noite-opening-qc.jpg',
  'gsa-motor-opening-qc.jpg',
  'gsa-agro-opening-qc.jpg',
  'gsa-em-fe-closing-qc.jpg',
  'gsa-bem-viver-closing-qc.jpg',
  'gsa-sabor-opening-qc.jpg',
  'gsa-esportes-closing-qc.jpg',
  'gsa-hora-da-palavra-opening-qc.jpg'
];

for (const f of files) {
  const b64 = await runSshScript(`base64 "${QC_DIR}/${f}"`, 20000);
  fs.writeFileSync(`${LOCAL_DIR}/${f}`, Buffer.from(b64.stdout.trim(), 'base64'));
  console.log(`Saved ${LOCAL_DIR}/${f}`);
}
