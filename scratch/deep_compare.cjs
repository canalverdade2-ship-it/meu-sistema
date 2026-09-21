const fs = require('fs');

const f1 = fs.readFileSync('server_webhook_vps_live.cjs', 'utf8');
const f2 = fs.readFileSync('server_webhook.cjs', 'utf8');

// Compare exports
console.log('=== module.exports ===');
const getExports = (file) => {
  const match = file.match(/module\.exports\s*=\s*\{([^}]+)\}/);
  if (!match) return [];
  return match[1].split(',').map(s => s.trim()).filter(Boolean);
};
console.log('vps_live exports:', getExports(f1));
console.log('webhook exports:', getExports(f2));

// Compare endpoints in the HTTP server
console.log('\n=== HTTP Endpoints handled in server ===');
const getEndpoints = (file) => {
  const lines = file.split('\n');
  const endpoints = [];
  lines.forEach((l, idx) => {
    if (l.includes('urlPath ===') || l.includes('urlPath.startsWith')) {
      endpoints.push({ line: idx + 1, endpoint: l.trim() });
    }
  });
  return endpoints;
};

console.log('vps_live endpoints:', getEndpoints(f1));
console.log('webhook endpoints:', getEndpoints(f2));
