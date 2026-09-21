import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dir = path.join(root, 'supabase', 'migrations');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql') && !f.endsWith('.b64')).sort();

// Table -> Map<policyName, policyData>
const tablePolicies = new Map();

function getPolicies(tbl) {
  const norm = tbl.toLowerCase().replace(/^public\./, '').replace(/^["']|["']$/g, '');
  if (!tablePolicies.has(norm)) tablePolicies.set(norm, new Map());
  return tablePolicies.get(norm);
}

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');

  // DROP POLICY
  const dropRegex = /DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_"]+)\s+ON\s+(?:public\.)?([a-zA-Z0-9_"]+)/gi;
  let dm;
  while ((dm = dropRegex.exec(content)) !== null) {
    const pName = dm[1].toLowerCase().replace(/^["']|["']$/g, '');
    const tbl = dm[2].toLowerCase().replace(/^["']|["']$/g, '');
    getPolicies(tbl).delete(pName);
  }

  // CREATE POLICY
  const createRegex = /CREATE\s+POLICY\s+([a-zA-Z0-9_"]+)\s+ON\s+(?:public\.)?([a-zA-Z0-9_"]+)([\s\S]*?);/gi;
  let cm;
  while ((cm = createRegex.exec(content)) !== null) {
    const pName = cm[1].toLowerCase().replace(/^["']|["']$/g, '');
    const tbl = cm[2].toLowerCase().replace(/^["']|["']$/g, '');
    const rest = cm[3];

    let cmd = 'ALL';
    const cmdM = rest.match(/FOR\s+(SELECT|INSERT|UPDATE|DELETE|ALL)/i);
    if (cmdM) cmd = cmdM[1].toUpperCase();

    let roles = ['public'];
    const rolesM = rest.match(/TO\s+([a-zA-Z0-9_,\s]+?)(?:USING|WITH\s+CHECK|$)/i);
    if (rolesM) roles = rolesM[1].split(',').map(r => r.trim().toLowerCase()).filter(Boolean);

    let qual = '';
    const qualM = rest.match(/USING\s*\(([\s\S]*?)\)(?:\s+WITH\s+CHECK|$)/i);
    if (qualM) qual = qualM[1].trim();

    let withCheck = '';
    const withCheckM = rest.match(/WITH\s+CHECK\s*\(([\s\S]*?)\)$/i);
    if (withCheckM) withCheck = withCheckM[1].trim();

    const upTo = content.substring(0, cm.index);
    const lineNum = upTo.split('\n').length;

    getPolicies(tbl).set(pName, {
      name: pName,
      cmd,
      roles,
      qual,
      withCheck,
      file,
      line: lineNum
    });
  }

  // Dynamic drops in loop: DROP POLICY IF EXISTS gsa_management_hardened ON public.%I
  if (file.includes('20260830235500_system_end_to_end_security_remediation.sql')) {
    const tablesInLoop = [
      'cobrancas','cobranca_historico','cobranca_acordo_parcelas','contratos',
      'parceiros_resgates','whatsapp_pendencias_ativas','blog_posts',
      'gsa_hero_banners','gsa_tv_channels','gsa_tv_media_items',
      'gsa_tv_schedule_slots','gsa_tv_playlists','gsa_tv_incidents',
      'gsa_tv_audit_log','gsa_tv_jobs'
    ];
    for (const t of tablesInLoop) {
      const pols = getPolicies(t);
      for (const [pn, pd] of pols.entries()) {
        if (pd.cmd === 'ALL' && pd.roles.includes('authenticated') && (pd.qual === 'true' || pd.qual === '')) {
          pols.delete(pn);
        }
      }
      pols.set('gsa_management_hardened', {
        name: 'gsa_management_hardened',
        cmd: 'ALL',
        roles: ['authenticated'],
        qual: "public.gsa_jwt_actor_type() IN ('admin','colaborador')",
        withCheck: "public.gsa_jwt_actor_type() IN ('admin','colaborador')",
        file,
        line: 70
      });
    }
  }
}

const targetTables = ['orcamento_timeline', 'contratos', 'ordens_servico', 'sistema_logs', 'whatsapp_pendencias_ativas'];

for (const t of targetTables) {
  console.log(`\n========================================`);
  console.log(`CURRENT POLICIES ON: ${t}`);
  console.log(`========================================`);
  const pols = getPolicies(t);
  if (pols.size === 0) {
    console.log('No active policies found!');
  } else {
    for (const [pn, p] of pols.entries()) {
      console.log(`- Policy: ${pn} [${p.cmd}] TO ${p.roles.join(', ')}`);
      console.log(`  USING: ${p.qual}`);
      if (p.withCheck) console.log(`  WITH CHECK: ${p.withCheck}`);
      console.log(`  Defined in: ${p.file}:${p.line}`);
    }
  }
}
