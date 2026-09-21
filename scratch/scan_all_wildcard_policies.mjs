import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dir = path.join(root, 'supabase', 'migrations');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql') && !f.endsWith('.b64')).sort();

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
      table: tbl,
      cmd,
      roles,
      qual,
      withCheck,
      file,
      line: lineNum
    });
  }

  // Handle specific dynamic drops in known migrations
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
        table: t,
        cmd: 'ALL',
        roles: ['authenticated'],
        qual: "public.gsa_jwt_actor_type() IN ('admin','colaborador')",
        withCheck: "public.gsa_jwt_actor_type() IN ('admin','colaborador')",
        file,
        line: 70
      });
    }
  }

  if (file.includes('20260910233000_client_panel_rls_hardening.sql')) {
    // drops marketplace_orders_read on orcamentos
    getPolicies('orcamentos').delete('marketplace_orders_read');
    getPolicies('ordens_compra').delete('marketplace_purchase_orders_read');
    getPolicies('loja_favoritos').delete('loja_favoritos_select_all');
    getPolicies('loja_favoritos').delete('cliente_select_loja_favoritos');
    getPolicies('loja_favoritos').delete('favoritos por cliente');
  }
}

const legitimatePublicTables = new Set([
  'blog_posts',
  'gsa_hero_banners',
  'gsa_tv_channels',
  'gsa_tv_media_items',
  'gsa_tv_schedule_slots',
  'produtos',
  'cupons_loja',
  'parceiros_resgates_public_status',
  'saude_planos_publicos',
  'parceiros_publicos'
]);

const suspiciousPolicies = [];

for (const [tbl, pols] of tablePolicies.entries()) {
  for (const [pName, p] of pols.entries()) {
    const qualNorm = p.qual.replace(/\s+/g, ' ').toLowerCase();
    const checkNorm = p.withCheck.replace(/\s+/g, ' ').toLowerCase();
    const isTrue = qualNorm === 'true' || qualNorm === '(true)' || checkNorm === 'true' || checkNorm === '(true)';

    const isPublic = p.roles.includes('public') || p.roles.includes('anon');
    const isAuth = p.roles.includes('authenticated');

    if (isTrue && (isPublic || isAuth)) {
      const isServiceRoleOnly = p.roles.length === 1 && p.roles[0] === 'service_role';
      const isManagement = pName.includes('management') || pName.includes('admin') || pName.includes('collaborator');
      
      if (!isServiceRoleOnly && !isManagement) {
        suspiciousPolicies.push({
          table: tbl,
          policy: pName,
          cmd: p.cmd,
          roles: p.roles,
          qual: p.qual,
          withCheck: p.withCheck,
          file: p.file,
          line: p.line,
          isLegitimatePublic: legitimatePublicTables.has(tbl)
        });
      }
    }
  }
}

console.log(`Found ${suspiciousPolicies.length} wildcard policies across all tables:`);
suspiciousPolicies.forEach(sp => {
  const flag = sp.isLegitimatePublic ? '[INTENDED PUBLIC]' : '🚨 [CRITICAL LEAK]';
  console.log(`${flag} Table: ${sp.table} | Policy: ${sp.policy} [${sp.cmd}] TO ${sp.roles.join(', ')}`);
  console.log(`   USING: ${sp.qual || '(empty)'} | WITH CHECK: ${sp.withCheck || '(empty)'}`);
  console.log(`   Source: ${sp.file}:${sp.line}\n`);
});
