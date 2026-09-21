import fs from 'node:fs';
function edit(p, fn){let s=fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');const out=fn(s);if(out===s)throw new Error(`no change ${p}`);fs.writeFileSync(p,out,'utf8');}
edit('src/components/client/store/StoreHubCoupons.tsx', s => s
  .replace("import { clientOperationalWrite } from '../../../lib/clientOperationalWrite';", "import { callClientRpc } from '../../../lib/clientRpc';")
  .replace("await clientOperationalWrite(clientId, 'cupons_ativados', 'insert', { cupom_id: cupomId });", "await callClientRpc('gsa_client_activate_store_coupon', { p_cupom_id: cupomId });"));
edit('src/components/client/store/CouponsPage.tsx', s => s
  .replace("import { clientOperationalWrite } from '../../../lib/clientOperationalWrite';", "import { callClientRpc } from '../../../lib/clientRpc';")
  .replace(/await clientOperationalWrite\(clientId, 'cupons_ativados', 'insert', \{ cupom_id: ([^}]+) \}\);/g, "await callClientRpc('gsa_client_activate_store_coupon', { p_cupom_id: $1 });"));
edit('src/App.tsx', s => s
  .replace("import { clientOperationalWrite } from './lib/clientOperationalWrite';", "import { clientOperationalWrite } from './lib/clientOperationalWrite';\nimport { callClientRpc } from './lib/clientRpc';")
  .replace("try { await clientOperationalWrite(clientId, 'cupons_ativados', 'insert', { cliente_id: clientId, cupom_id: cupomId }); } catch { /* ignore duplicate */ }", "try { await callClientRpc('gsa_client_activate_store_coupon', { p_cupom_id: cupomId }); } catch { /* estado já pode estar ativado */ }"));
console.log('COUPON_ACTIVATION_CALLS_PATCHED');
