const fs = require('fs');

const f1 = fs.readFileSync('server_webhook_vps_live.cjs', 'utf8');
const f2 = fs.readFileSync('server_webhook.cjs', 'utf8');

// Let's check diff chunks by analyzing major state machine branches
const getStates = (file) => {
  const matches = [...file.matchAll(/session\.state\s*===?\s*'([^']+)'/g)];
  return Array.from(new Set(matches.map(m => m[1])));
};

console.log('vps_live states count:', getStates(f1).length);
console.log('webhook states count:', getStates(f2).length);

const s1 = getStates(f1);
const s2 = getStates(f2);

console.log('States only in vps_live:', s1.filter(x => !s2.includes(x)));
console.log('States only in webhook:', s2.filter(x => !s1.includes(x)));
