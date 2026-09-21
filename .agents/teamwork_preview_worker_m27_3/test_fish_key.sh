#!/usr/bin/env bash
node - <<'EOF'
import fs from 'node:fs';
import crypto from 'node:crypto';
import cp from 'node:child_process';

const FISH_VAULT = '/home/opc/gsa-ai/secrets/fish-production.enc.json';
const v = JSON.parse(fs.readFileSync(FISH_VAULT, 'utf8'));
let hexKey = cp.execFileSync('sudo', ['docker', 'exec', 'gsa-tv-control-plane', 'printenv', 'GSA_TV_SECRET_KEY'], { encoding: 'utf8' }).trim();
const k = Buffer.from(hexKey, 'hex');
const n = Buffer.from(v.nonce, 'base64url');
const a = Buffer.from(v.ciphertext, 'base64url');
const t = a.subarray(-16);
const b = a.subarray(0, -16);
const d = crypto.createDecipheriv('aes-256-gcm', k, n);
d.setAAD(Buffer.from(v.aad));
d.setAuthTag(t);
const decrypted = JSON.parse(Buffer.concat([d.update(b), d.final()]).toString('utf8'));
console.log("Fish API Key available:", !!decrypted.api_key, "Length:", decrypted.api_key.length);
EOF
