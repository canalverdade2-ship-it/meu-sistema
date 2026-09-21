#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

// Compatibility entry point: the production owner alone links eligible library media.
// Never manufacture title cards under movie names or invent approval/rights metadata.
const args = ['/opt/gsa-tv/bin/night-production.py', '--reconcile', '--require-ready'];
if (process.argv[2]) args.push('--date', process.argv[2]);
console.log('[Acervo] Conferindo vídeos existentes e aprovados na programação.');
const result = spawnSync('/usr/bin/python3', args, {
  stdio: 'inherit',
  env: { ...process.env, PATH: '/usr/local/bin:/usr/bin:/bin' },
});
if (result.error) console.error('[Acervo] Não foi possível executar a conferência.');
process.exit(result.status ?? 1);
