const assert = require('assert');
const live = require('../../server_webhook_vps_live.cjs');
const local = require('../../server_webhook.cjs');

console.log('=== AUDITOR INDEPENDENT STRESS & INTEGRITY TEST ===');

// 1. Fuzzy Search Robustness & Edge Cases
const partners = [
  { id: '1', name: 'Petlove', slug: 'petlove', category: 'Pet', benefits: '100% off' },
  { id: '2', name: 'Drogasil Farmácias', slug: 'drogasil', category: 'Farmácia', benefits: '45% off' },
  { id: '3', name: 'Óticas Carol', slug: 'oticas-carol', category: 'Ótica', benefits: '20% off' }
];

console.log('[1] Fuzzy Search Edge Cases:');
assert.strictEqual(live.searchPartnersFuzzy('', partners).length, 3);
assert.strictEqual(live.searchPartnersFuzzy(null, partners).length, 3);
assert.strictEqual(live.searchPartnersFuzzy(undefined, partners).length, 3);

const stopWordRes = live.searchPartnersFuzzy('quero o desconto da drogasil por favor', partners);
assert.strictEqual(stopWordRes.length, 1);
assert.strictEqual(stopWordRes[0].slug, 'drogasil');

const accentRes = live.searchPartnersFuzzy('OTICAS CAROL', partners);
assert.strictEqual(accentRes.length, 1);
assert.strictEqual(accentRes[0].slug, 'oticas-carol');

const sqliRes = live.searchPartnersFuzzy("' OR '1'='1 --", partners);
assert.strictEqual(sqliRes.length, 0);

console.log('  -> All fuzzy search assertions passed.');

// 2. NLU Intent Extraction
console.log('[2] NLU Fallback Intent Extraction:');
const nlu1 = live.parseProtocolIntentFallback('quero resgatar cupom petlove');
assert.strictEqual(nlu1.intent, 'resgatar');
assert.strictEqual(nlu1.field, 'parceiro');
assert.ok(nlu1.new_value.includes('petlove'));

const nlu2 = live.parseProtocolIntentFallback('cancelar protocolo PROT-RES-2026-ABCDEF');
assert.strictEqual(nlu2.intent, 'cancelar');

const nlu3 = live.parseProtocolIntentFallback('alterar meu email para novo@gsa.com');
assert.strictEqual(nlu3.intent, 'alterar');
assert.strictEqual(nlu3.field, 'email');
assert.strictEqual(nlu3.new_value, 'novo@gsa.com');

console.log('  -> All NLU fallback assertions passed.');

// 3. Dual-Server Function Parity & Export Integrity
console.log('[3] Dual-Server Function Parity & Export Integrity:');
const requiredFunctions = [
  'searchPartnersFuzzy',
  'checkDuplicateRedemptionDb',
  'handlePartnerRedemptionFlow',
  'callGeminiProtocolNLU',
  'executeBenefitRedemptionRpc',
  'selectRedemptionPartner',
  'dispatchAdminRedemptionAlert',
  'extractPartnerTermFromText'
];

requiredFunctions.forEach(fn => {
  assert.strictEqual(typeof live[fn], 'function', `liveWebhook.${fn} must be function`);
  assert.strictEqual(typeof local[fn], 'function', `localWebhook.${fn} must be function`);
});
console.log('  -> All 8 required functions exist and are exported on both live and local webhooks.');

// 4. Duplicate Check Parameter Handling
console.log('[4] Duplicate Check Parameter Handling:');
live.checkDuplicateRedemptionDb(null, null, null, (err, isDupe, row) => {
  assert.strictEqual(err, null);
  assert.strictEqual(isDupe, false);
  assert.strictEqual(row, null);
});
console.log('  -> Null parameter duplicate check returns cleanly.');

// 5. Admin Master Phone Number Verification
console.log('[5] Admin Master Notification Phone:');
assert.strictEqual(live.ADMIN_MASTER_PHONE, '5511971858372');
assert.strictEqual(local.ADMIN_MASTER_PHONE, '5511971858372');
console.log('  -> Admin Master phone is 5511971858372 on both servers.');

console.log('\n=== AUDITOR STRESS TEST FINISHED: 100% CLEAN ===\n');
process.exit(0);
