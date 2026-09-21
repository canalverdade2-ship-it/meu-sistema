import fs from 'node:fs';
const p = String.raw`C:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\supabase\functions\gsa-ads-public\index.ts`;
let s = fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
const marker = "function onlyDigits(value: unknown) { return String(value || '').replace(/\\D/g, ''); }";
const helper = marker + "\nfunction text(value: unknown, maxLength: number) { return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''; }";
if (!s.includes('function text(value: unknown, maxLength: number)')) { if (!s.includes(marker)) throw new Error('helper marker missing'); s = s.replace(marker, helper); }
fs.writeFileSync(p,s,'utf8');
console.log('text helper added');
