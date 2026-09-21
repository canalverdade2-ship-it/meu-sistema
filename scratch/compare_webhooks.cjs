const fs = require('fs');

const f1 = fs.readFileSync('server_webhook_vps_live.cjs', 'utf8');
const f2 = fs.readFileSync('server_webhook.cjs', 'utf8');

const matchLines = (file, str) => {
  const lines = file.split('\n');
  const results = [];
  lines.forEach((l, idx) => {
    if (l.includes(str)) results.push({ line: idx + 1, content: l.trim() });
  });
  return results;
};

console.log('=== SERVICE_ROLE_JWT declaration ===');
console.log('vps_live:', matchLines(f1, 'const SERVICE_ROLE_JWT'));
console.log('webhook:', matchLines(f2, 'const SERVICE_ROLE_JWT'));

console.log('\n=== processMessage definition ===');
console.log('vps_live:', matchLines(f1, 'function processMessage'));
console.log('webhook:', matchLines(f2, 'function processMessage'));

console.log('\n=== Webhook Entry Point (processMessage invocation in POST /webhook) ===');
console.log('vps_live:');
f1.split('\n').forEach((l, idx) => {
  if (idx > 9000 && l.includes('processMessage(')) {
    console.log(`  Line ${idx + 1}: ${l.trim()}`);
  }
});
console.log('webhook:');
f2.split('\n').forEach((l, idx) => {
  if (idx > 9000 && l.includes('processMessage(')) {
    console.log(`  Line ${idx + 1}: ${l.trim()}`);
  }
});

console.log('\n=== Loyalty Actions / Points Conversion ===');
console.log('vps_live LOYALTY_ACTIONS:');
f1.split('\n').forEach((l, idx) => {
  if (l.includes("session.state === 'LOYALTY_ACTIONS'")) {
    console.log(`  Line ${idx + 1}: ${l.trim()}`);
  }
});
console.log('webhook LOYALTY_ACTIONS:');
f2.split('\n').forEach((l, idx) => {
  if (l.includes("session.state === 'LOYALTY_ACTIONS'")) {
    console.log(`  Line ${idx + 1}: ${l.trim()}`);
  }
});

console.log('\n=== supabaseRpc helper ===');
console.log('vps_live:', matchLines(f1, 'function supabaseRpc'));
console.log('webhook:', matchLines(f2, 'function supabaseRpc'));
