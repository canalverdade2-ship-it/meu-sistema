import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dir = path.join(root, 'supabase', 'migrations');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql') && !f.endsWith('.b64')).sort();

const triggers = new Map(); // key -> triggerObj

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');

  // DROP TRIGGER
  const dropTrgRegex = /DROP\s+TRIGGER\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_]+)\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)/gi;
  let dtm;
  while ((dtm = dropTrgRegex.exec(content)) !== null) {
    const trgName = dtm[1].toLowerCase();
    const rawTbl = dtm[2].toLowerCase();
    triggers.delete(`${trgName}@${rawTbl}`);
  }

  // CREATE TRIGGER
  const trgRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+([a-zA-Z0-9_]+)\s+(BEFORE|AFTER|INSTEAD\s+OF)\s+([a-zA-Z0-9_\s\(\),]+?)\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)[\s\S]*?EXECUTE\s+(?:FUNCTION|PROCEDURE)\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(/gi;
  let trgMatch;
  while ((trgMatch = trgRegex.exec(content)) !== null) {
    const trgName = trgMatch[1].toLowerCase();
    const timing = trgMatch[2].toUpperCase();
    const events = trgMatch[3].trim().toUpperCase().replace(/\s+/g, ' ');
    const rawTbl = trgMatch[4].toLowerCase();
    const funcName = trgMatch[5].toLowerCase();

    const upTo = content.substring(0, trgMatch.index);
    const lineNum = upTo.split('\n').length;

    triggers.set(`${trgName}@${rawTbl}`, {
      name: trgName,
      table: rawTbl,
      timing,
      events,
      func: funcName,
      file,
      line: lineNum
    });
  }

  // Dynamic trigger loops
  if (file.includes('20260830052000_complete_admin_mutation_audit_coverage.sql')) {
    const tables = [
      'contratos','demanda_comentarios','gsa_tv_media_items','gsa_tv_schedule_slots',
      'gsa_whatsapp_ramais','loja_categorias','prestador_historico','prestador_premios',
      'prestador_promocoes','viagens_pacote_imagens','vouchers','suporte_mensagens','prestador_suporte_demandas'
    ];
    for (const t of tables) {
      const trgName = `trg_gsa_admin_audit_${t}`;
      triggers.set(`${trgName}@${t}`, {
        name: trgName,
        table: t,
        timing: 'AFTER',
        events: 'INSERT OR UPDATE OR DELETE',
        func: 'gsa_admin_sensitive_change_audit',
        file,
        line: 32
      });
    }
  }
}

console.log(`Total active triggers tracked: ${triggers.size}`);

const financialTriggers = [];
const auditTriggers = [];
const businessTriggers = [];

for (const [key, trg] of triggers.entries()) {
  if (trg.name.includes('saldo') || trg.func.includes('saldo') || trg.name.includes('wallet') || trg.name.includes('pontos')) {
    financialTriggers.push(trg);
  } else if (trg.name.includes('audit') || trg.func.includes('audit')) {
    auditTriggers.push(trg);
  } else {
    businessTriggers.push(trg);
  }
}

console.log(`\nFinancial Triggers: ${financialTriggers.length}`);
financialTriggers.forEach(t => console.log(`- [${t.timing} ${t.events}] ON ${t.table} -> ${t.func}() (${t.file}:${t.line})`));

console.log(`\nAudit Triggers: ${auditTriggers.length}`);
console.log(`Business/Workflow Triggers: ${businessTriggers.length}`);
businessTriggers.slice(0, 15).forEach(t => console.log(`- [${t.timing} ${t.events}] ON ${t.table} -> ${t.func}() (${t.file}:${t.line})`));
