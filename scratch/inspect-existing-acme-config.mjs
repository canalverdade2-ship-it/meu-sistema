import { runSshScript } from './ssh2-run.mjs';
const script=`set -u
echo '=== root acme ==='
sudo ls -l /root/.acme.sh/acme.sh 2>/dev/null || true
echo '=== safe cert params ==='
sudo grep -E '^(Le_Domain|Le_Alt|Le_Webroot|Le_PreHook|Le_PostHook|Le_RenewHook|Le_ReloadCmd|Le_API|Le_Keylength|Le_RealCertPath|Le_RealCACertPath|Le_RealKeyPath|Le_RealFullChainPath)=' /root/.acme.sh/api.147-15-43-141.nip.io_ecc/api.147-15-43-141.nip.io.conf 2>/dev/null || true
`;
const r=await runSshScript(script,60000);process.stdout.write(r.stdout);process.stderr.write(r.stderr);
