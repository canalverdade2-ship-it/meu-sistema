'use strict';

const TIME_ZONE = 'America/Sao_Paulo';
const WEEKDAYS = { Sun: 'domingo', Mon: 'segunda', Tue: 'terca', Wed: 'quarta', Thu: 'quinta', Fri: 'sexta', Sat: 'sabado' };

function zonedParts(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
  }).formatToParts(value).reduce((result, part) => {
    if (part.type !== 'literal') result[part.type] = part.value;
    return result;
  }, {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, day: Number(parts.day), weekday: WEEKDAYS[parts.weekday] };
}

function normalizeTimes(value) {
  const values = Array.isArray(value) ? value : [];
  return [...new Set(values.map(item => String(item || '').trim().slice(0, 5))
    .filter(item => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(item)))].sort();
}

function dateWithinBounds(config, localDate) {
  if (config.data_inicio && localDate < String(config.data_inicio).slice(0, 10)) return false;
  if (config.data_fim && localDate > String(config.data_fim).slice(0, 10)) return false;
  return true;
}

function isDue(config, value = new Date()) {
  if (!config?.id || config.ativo !== true) return null;
  const local = zonedParts(value);
  if (!dateWithinBounds(config, local.date)) return null;
  const times = normalizeTimes(config.horarios);
  if (!times.includes(local.time)) return null;

  const frequency = String(config.frequencia || 'diario').toLowerCase();
  if (frequency === 'semanal') {
    const days = Array.isArray(config.dias_semana) ? config.dias_semana : [];
    if (!days.includes(local.weekday)) return null;
  } else if (frequency === 'mensal') {
    const reference = String(config.data_inicio || config.created_at || '').slice(0, 10);
    if (Number(reference.slice(8, 10)) !== local.day) return null;
  } else if (frequency === 'uma_vez') {
    const reference = String(config.data_inicio || config.created_at || '').slice(0, 10);
    if (!reference || local.date !== reference || local.time !== times[0]) return null;
  } else if (!['diario', 'horario'].includes(frequency)) return null;

  return {
    key: `${config.id}:${local.date}:${local.time}`,
    scheduledFor: `${local.date}T${local.time}:00`, localDate: local.date,
    localTime: local.time, timezone: TIME_ZONE,
  };
}

function createScrapingScheduler({ listConfigs, listRecentLogs, enqueue, logger = console, intervalMs = 20_000 }) {
  let timer = null;
  let checking = false;
  const claimed = new Set();

  async function tick(value = new Date()) {
    if (checking) return [];
    checking = true;
    const queued = [];
    try {
      const configs = await listConfigs();
      for (const config of configs || []) {
        const slot = isDue(config, value);
        if (!slot || claimed.has(slot.key)) continue;
        claimed.add(slot.key);
        try {
          const logs = await listRecentLogs(config.id);
          if ((logs || []).some(log => log?.detalhes?.schedule_key === slot.key)) continue;
          await enqueue(config, slot);
          queued.push(slot.key);
          logger.info?.(`[ScrapingScheduler] Execução agendada: ${config.nome || config.id} (${slot.scheduledFor} ${slot.timezone})`);
        } catch (error) {
          claimed.delete(slot.key);
          logger.error?.(`[ScrapingScheduler] Falha ao agendar ${config.nome || config.id}:`, error?.message || error);
        }
      }
    } catch (error) {
      logger.error?.('[ScrapingScheduler] Falha ao consultar automações:', error?.message || error);
    } finally { checking = false; }
    return queued;
  }

  function start() {
    if (timer) return;
    void tick();
    timer = setInterval(() => void tick(), intervalMs);
    logger.info?.(`[ScrapingScheduler] Ativo a cada ${Math.round(intervalMs / 1000)}s no fuso ${TIME_ZONE}.`);
  }
  function stop() { if (timer) clearInterval(timer); timer = null; }
  return { start, stop, tick };
}

module.exports = { TIME_ZONE, createScrapingScheduler, isDue, normalizeTimes, zonedParts };
