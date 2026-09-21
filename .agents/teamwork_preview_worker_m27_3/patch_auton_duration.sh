#!/usr/bin/env bash
set -e

node -e "
const fs = require('fs');
const file = '/opt/gsa-tv/cache/media/1/production/autonomous/tools/autonomous-script.cjs';
let content = fs.readFileSync(file, 'utf8');

const target = 'const expectedSeconds = task.targetSeconds || Math.round(audioDuration);';
const replacement = 'let expectedSeconds = task.targetSeconds || Math.round(audioDuration);\n  const ratio = audioDuration / expectedSeconds;\n  if (ratio < 0.90 || ratio > 1.10) expectedSeconds = Math.round(audioDuration);';

if (!content.includes(target)) {
  console.error('Target string not found!');
  process.exit(1);
}

content = content.replace(target, replacement);
fs.writeFileSync(file, content, 'utf8');
console.log('Successfully patched autonomous-script.cjs!');
"
