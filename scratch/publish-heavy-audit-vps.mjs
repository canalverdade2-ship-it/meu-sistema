import fs from 'node:fs';
import { Client } from 'ssh2';
import { readInfraKey } from './ssh2-run.mjs';

const report = fs.readFileSync(new URL('../audit/GSA_TV_AUDITORIA_PESADA_2026-09-06.md', import.meta.url));
const now = new Date().toISOString();
const entry = `\n## ${now} — Auditoria pesada integral pós-migração\n\n- Executada auditoria somente leitura em painel, Control Plane, Encoder Engine, ffplayout, watchdog, PostgreSQL, filas, grade, mídia, backup, segurança, rede, recursos, logs, testes e consistência repositório/VPS. Nenhum processo de transmissão foi reiniciado.\n- Relatório técnico consolidado publicado em /home/opc/gsa-ai/GSA_TV_AUDITORIA_PESADA_2026-09-06.md.\n- Achados críticos adicionais: frontend fabrica sucesso quando RPC falha; watchdog registra hls_ok=true com HLS legado atrasado mais de 34 horas; backups integrais de 03/04/05-09 falharam e ficaram running; backup omite Encoder Engine; todos os 1.116 blocos futuros publicados estão sem ativo; mídia com permissões 777; segredo ffplayout do Control Plane em 644; múltiplos serviços internos expostos em portas públicas da VPS.\n- Achados altos adicionais: corrida de boot sem dependência/reattempt; health/heartbeat incompletos; API Engine sem mutex; grade/filler com durações incompatíveis; código de produção divergente do repositório; ausência de HA; job preso há mais de 37 horas; suíte gsa-tv com três contratos falhando e falso positivo de backup; ausência de limites de recursos.\n- Validações positivas: exatamente um publicador RTMP; Engine produtor/transportador ativos; HLS final recente; portas 9202/9210/5577 em localhost; rotas administrativas externas rejeitam acesso sem sessão; grade semanal cobre 24x7; mídias ready têm caminho/duração/direitos válidos.\n- Parecer: transmissão operacional no instante da coleta, mas migração não concluída e continuidade 24x7 ainda não comprovada. Correções devem seguir a ordem de risco registrada no relatório.\n`;

function connect() {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => resolve(conn));
    conn.on('error', reject);
    conn.connect({ host: '147.15.43.141', port: 22, username: 'opc', privateKey: readInfraKey(), readyTimeout: 15000 });
  });
}
function write(sftp, path, data, flags) {
  return new Promise((resolve, reject) => {
    const stream = sftp.createWriteStream(path, { flags, mode: 0o644 });
    stream.on('close', resolve); stream.on('error', reject); stream.end(data);
  });
}
const conn = await connect();
const sftp = await new Promise((resolve, reject) => conn.sftp((e, s) => e ? reject(e) : resolve(s)));
await write(sftp, '/home/opc/gsa-ai/GSA_TV_AUDITORIA_PESADA_2026-09-06.md', report, 'w');
await write(sftp, '/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md', Buffer.from(entry), 'a');
conn.end();
process.stdout.write(now + '\n');
