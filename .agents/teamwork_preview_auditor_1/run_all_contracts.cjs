const { execSync } = require('child_process');

const scripts = [
  'scripts/check-gsa-travel-contracts.ts',
  'scripts/check-classifieds-production-contracts.ts',
  'scripts/check-client-portal-security-contracts.ts',
  'scripts/check-client-session-restore-contract.ts',
  'scripts/check-client-audience-portals.ts',
  'scripts/check-restricted-access-hub.ts',
  'scripts/check-provider-portal-security-contracts.ts',
  'scripts/check-supplier-procurement-contracts.ts',
  'scripts/check-home-public-contracts.ts',
  'scripts/check-free-tools-contracts.ts',
  'scripts/check-free-tools-pdf-contracts.ts',
  'scripts/check-partners-contracts.ts',
  'scripts/check-affiliate-contracts.ts',
  'scripts/check-realtime-contracts.ts',
  'scripts/check-careers-contracts.ts',
  'scripts/check-site-campaign-contracts.ts',
  'scripts/check-products-subscriptions-contracts.ts',
  'scripts/check-gsa-store-experience.ts',
  'scripts/check-advertising-foundation.ts',
  'scripts/check-advertising-completion.ts',
  'scripts/check-restored-admin-foundations.ts',
  'scripts/check-protection-direct-quote-contracts.ts',
  'scripts/check-collaborator-boundary-contracts.ts'
];

let passed = 0;
let failed = 0;
const failures = [];

for (const script of scripts) {
  try {
    process.stdout.write(`Testing ${script}... `);
    const out = execSync(`npx tsx ${script}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    console.log('OK');
    passed++;
  } catch (err) {
    console.log('FAIL');
    console.error(err.stderr || err.stdout || err.message);
    failed++;
    failures.push({ script, error: err.stderr || err.stdout || err.message });
  }
}

console.log(`\nResults: ${passed} passed, ${failed} failed out of ${scripts.length} contract scripts.`);
if (failed > 0) {
  process.exit(1);
}
