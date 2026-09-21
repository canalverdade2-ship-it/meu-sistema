#!/usr/bin/env bash
docker exec -i gsa-tv-control-plane node -e "
const fs = require('fs');
const code = fs.readFileSync('/app/src/gemini.js', 'utf8');
const idx = code.indexOf('generateText');
console.log(code.substring(idx, idx + 1000));
"
