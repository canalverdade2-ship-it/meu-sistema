#!/usr/bin/env bash
docker exec -i gsa-tv-control-plane node -e "
const fs = require('fs');
const code = fs.readFileSync('/app/src/gemini.js', 'utf8');
console.log(code.substring(0, 1500));
console.log('\n--- SPEECH FUNCTION ---');
const idx = code.indexOf('generateSpeech');
if (idx !== -1) console.log(code.substring(idx, idx + 1500));
"
