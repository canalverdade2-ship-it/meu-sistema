'use strict';

/**
 * ============================================================================
 * GSA OS — WhatsApp Anti-Ban Shield Core Engine
 * ============================================================================
 * Features:
 *  - R1: Per-contact FIFO message queue with randomized intervals (2s - 6s)
 *        and concurrent cross-contact isolation + idle queue cleanup.
 *  - R2: Realistic human presence emulation (composing / recording) via Evolution API
 *        with dynamic typing duration scaling based on character count.
 *  - R3: Recursive Spintax parser ({A|{B|C}}) preserving template variables
 *        + Contextual dynamic greeting generator.
 *  - R4: Exponential backoff retry with jitter on 5xx, 429, and network timeouts.
 *        Fast-fail on non-retryable 4xx client errors.
 * ============================================================================
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

// ─── CONFIGURATION & ENVIRONMENT OVERRIDES ──────────────────────────────────
function getConfig() {
  const rawUrl = process.env.EVOLUTION_API_URL || 'http://127.0.0.1:8080';
  const apiUrl = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
  const apiKey = process.env.EVOLUTION_API_KEY || 'gsa_hub_evolution_token_2026';
  const instance = process.env.EVOLUTION_INSTANCE || 'GSA_WhatsApp';
  const timeScale = Math.max(0.001, Number(process.env.TIME_SCALE || 1.0));

  return {
    apiUrl,
    apiKey,
    instance,
    timeScale,
    minInterMessageDelay: 3500,
    maxInterMessageDelay: 7500,
    minTypingDelay: 5000,
    maxTypingDelay: 20000,
    msPerChar: 55,
    maxRetries: 3,
    baseBackoffMs: 1000,
    maxBackoffMs: 8000,
    idleQueueTimeoutMs: 30000,
    maxQueueDepth: 50
  };
}

// ─── HELPER: SLEEP WITH TIME SCALING ────────────────────────────────────────
function sleep(ms, config = getConfig()) {
  const scaledMs = Math.max(1, Math.round(ms * config.timeScale));
  return new Promise(resolve => setTimeout(resolve, scaledMs));
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── LID ROUTING & JID CONTEXT REGISTRATION ─────────────────────────────────
const contactContextMap = new Map(); // cleanDigits -> { jid, lastKey, updatedAt }

function registerContactContext(phoneOrJid, targetJid, messageKey = null) {
  if (!phoneOrJid) return;
  const digits = String(phoneOrJid).replace(/\D/g, '');
  const jid = targetJid ? String(targetJid).trim() : (String(phoneOrJid).includes('@') ? String(phoneOrJid).trim() : null);
  
  if (!jid && !digits) return;
  
  const existing = digits ? contactContextMap.get(digits) : contactContextMap.get(String(phoneOrJid).trim());
  
  // NEVER overwrite an existing valid @lid with a @s.whatsapp.net or raw digits!
  let finalJid = jid;
  if (existing && existing.jid && existing.jid.includes('@lid')) {
    if (!jid || !jid.includes('@lid')) {
      finalJid = existing.jid; // Preserve the LID!
    }
  }

  const entry = {
    jid: finalJid,
    lastKey: messageKey || (existing ? existing.lastKey : null),
    updatedAt: Date.now()
  };

  if (digits && finalJid) {
    contactContextMap.set(digits, entry);
    // Also map without country code 55 or with country code 55
    if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
      contactContextMap.set(digits.substring(2), entry);
    } else if (digits.length === 10 || digits.length === 11) {
      contactContextMap.set('55' + digits, entry);
    }
  }

  if (String(phoneOrJid).includes('@') && finalJid) {
    contactContextMap.set(String(phoneOrJid).trim(), entry);
  }
}

const fs = require('fs');
const path = require('path');

const LID_CACHE_FILE = path.join(__dirname, '..', 'lid_cache.json');
const VPS_LID_CACHE_FILE = '/home/opc/lid_cache.json';

function loadLidMappingsFromDb() {
  // 1. Try loading from fast persistent JSON file
  const cachePath = fs.existsSync(VPS_LID_CACHE_FILE) ? VPS_LID_CACHE_FILE : (fs.existsSync(LID_CACHE_FILE) ? LID_CACHE_FILE : null);
  if (cachePath) {
    try {
      const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      let count = 0;
      for (const [phone, lid] of Object.entries(data)) {
        if (phone && lid) {
          registerContactContext(phone, lid);
          count++;
        }
      }
      if (count > 0) {
        console.log(`🛡️ [Anti-Ban Shield] Carregados ${count} mapeamentos de LID do cache (${cachePath})`);
        return;
      }
    } catch (e) {
      console.warn('⚠️ [Anti-Ban Shield] Erro ao ler lid_cache.json:', e.message);
    }
  }

  // 2. Pre-seed default known admin LIDs
  registerContactContext('5511971858372', '38830967099420@lid');
  registerContactContext('11971858372', '38830967099420@lid');
  registerContactContext('5511972311700', '277734211215412@lid');
  registerContactContext('11972311700', '277734211215412@lid');
}

// Auto-run on module load
try {
  loadLidMappingsFromDb();
} catch (_) {}

function resolveTargetJid(to) {
  if (!to) return '';
  const str = String(to).trim();
  
  // If already a full JID (LID or group or user JID)
  if (str.includes('@lid') || str.includes('@g.us') || str.includes('@s.whatsapp.net')) {
    return str;
  }

  const cleanDigits = str.replace(/\D/g, '');
  if (!cleanDigits) return str;

  // Check if we have an active LID/JID context for this contact
  const ctx = contactContextMap.get(cleanDigits);
  if (ctx && ctx.jid) {
    return ctx.jid;
  }

  // Fallback to standard WhatsApp phone number format
  if (cleanDigits.length === 10 || cleanDigits.length === 11) {
    return '55' + cleanDigits;
  }
  return cleanDigits;
}

function getContactContext(to) {
  if (!to) return null;
  const cleanDigits = String(to).replace(/\D/g, '');
  return contactContextMap.get(cleanDigits) || contactContextMap.get(String(to).trim()) || null;
}

// ─── RECIPIENT NORMALIZATION ────────────────────────────────────────────────
function normalizeRecipient(to) {
  if (!to) return '';
  const str = String(to).trim();
  if (str.includes('@lid') || str.includes('@g.us') || str.includes('@s.whatsapp.net')) {
    return str;
  }
  const target = resolveTargetJid(to);
  if (target) return target;
  const cleanDigits = str.replace(/\D/g, '');
  if (cleanDigits) return cleanDigits;
  return str;
}

// ─── R3: SPINTAX PARSER & GREETING GENERATOR ────────────────────────────────
/**
 * Recursively resolves Spintax {Option A|Option B|Option C} patterns,
 * including nested groups, while preserving template variables without pipes (e.g. {nome}, {link}, {valor}).
 */
function parseSpintax(text) {
  if (!text || typeof text !== 'string') return text;
  
  let result = text;
  // Matches innermost curly braces: {anything without inner { or }}
  const regex = /\{([^{}]+)\}/g;
  let iterations = 0;
  const maxIterations = 50;

  while (iterations < maxIterations) {
    let hasSpintax = false;
    result = result.replace(regex, (match, contents) => {
      // Only treat as Spintax if it contains pipe separator (|)
      if (contents.includes('|')) {
        hasSpintax = true;
        const options = contents.split('|');
        const chosen = options[Math.floor(Math.random() * options.length)];
        return chosen;
      }
      // Preserve single variables like {nome} or {link}
      return match;
    });

    if (!hasSpintax) break;
    iterations++;
  }

  return result;
}

/**
 * Generates a randomized contextual greeting based on the current hour (UTC-3 Brazil Time).
 */
function getDynamicGreeting(name) {
  // Current hour in America/Sao_Paulo (UTC-3)
  const now = new Date();
  const utcHour = now.getUTCHours();
  // Brazil standard time is UTC-3
  let brHour = (utcHour - 3 + 24) % 24;

  let greetingTemplate = '';
  if (brHour >= 5 && brHour < 12) {
    greetingTemplate = '{Bom dia|Olá, bom dia|Oi, tudo bem? Bom dia}';
  } else if (brHour >= 12 && brHour < 18) {
    greetingTemplate = '{Boa tarde|Olá, boa tarde|Oi! Boa tarde}';
  } else {
    greetingTemplate = '{Boa noite|Olá, boa noite|Oi! Boa noite}';
  }

  const baseGreeting = parseSpintax(greetingTemplate);
  if (name && typeof name === 'string' && name.trim()) {
    const cleanName = name.trim().split(' ')[0];
    const nameIntro = parseSpintax(`{, *${cleanName}*| *${cleanName}*}`);
    return `${baseGreeting}${nameIntro}!`;
  }

  return `${baseGreeting}!`;
}

// ─── MARKDOWN NORMALIZATION ─────────────────────────────────────────────────
function formatToWhatsAppMarkdown(text) {
  if (!text || typeof text !== 'string') return text;

  let formatted = text;

  // 1. Headers Markdown (# Header) -> Bold WhatsApp (*Header*)
  formatted = formatted.replace(/^#{1,6}\s+(.+)$/gm, '*$1*');

  // 2. List bullets (+ item or - item) -> Clean bullet (• item) (removed * to avoid breaking bold on new lines)
  formatted = formatted.replace(/^(\s*)[\+\-]\s+/gm, '$1• ');

  // 3. Triple bold/italic (***text***) -> Bold Italic (*_text_*)
  formatted = formatted.replace(/\*\*\*(.*?)\*\*\*/g, '*_$1_*');
  formatted = formatted.replace(/___(.*?)___/g, '*_$1_*');

  // 4. Double bold (**text**) -> Single bold (*text*)
  formatted = formatted.replace(/\*\*([^\*\n]+?)\*\*/g, '*$1*');

  // 5. Fix spaces inside asterisks - WhatsApp requires NO space inside asterisks for bold to work
  // Using [ \t] instead of \s to prevent matching \n and eating line breaks!
  formatted = formatted.replace(/\*[ \t]+([^\*\n]+?)[ \t]+\*/g, '*$1*');
  
  // 6. Markdown links [Text](URL) -> Text (URL)
  formatted = formatted.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '$1 ($2)');

  return formatted;
}

// ─── R2: DYNAMIC TYPING DURATION & PRESENCE EMULATION ────────────────────────
/**
 * Calculates typing or recording presence duration in ms based on content length.
 * Formula: clamp(1500ms, base + charCount * 35ms + random(0, 500ms), 8000ms)
 */
function calculateTypingDelay(text, mediaType = 'text', config = getConfig()) {
  if (mediaType === 'audio') {
    // Audio recording presence duration
    return getRandomInt(2500, 5000);
  }

  if (mediaType === 'document' || mediaType === 'image') {
    // Document or Image presence baseline (simulates file picking / upload)
    const captionLen = (text || '').length;
    const base = getRandomInt(2000, 3500) + (captionLen * 20);
    return Math.min(config.maxTypingDelay, Math.max(config.minTypingDelay, base));
  }

  const charCount = (text || '').length;
  const rawDuration = config.minTypingDelay + (charCount * config.msPerChar) + getRandomInt(0, 500);
  return Math.min(config.maxTypingDelay, Math.max(config.minTypingDelay, rawDuration));
}

/**
 * Raw dispatch of presence to Evolution API
 */
async function sendPresenceRaw(cleanPhone, presenceType = 'composing', durationMs = 4000, config = getConfig()) {
  if (!cleanPhone) return false;

  const urlObj = new URL(`${config.apiUrl}/chat/sendPresence/${config.instance}`);
  const payload = JSON.stringify({
    number: cleanPhone,
    delay: Math.max(2000, durationMs || 4000),
    presence: presenceType
  });

  const isHttps = urlObj.protocol === 'https:';
  const transport = isHttps ? https : http;

  const options = {
    hostname: urlObj.hostname,
    port: urlObj.port || (isHttps ? 443 : 80),
    path: urlObj.pathname + urlObj.search,
    method: 'POST',
    headers: {
      'apikey': config.apiKey,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    },
    timeout: 4000
  };

  try {
    return await new Promise((resolve) => {
      const req = transport.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => resolve(res.statusCode >= 200 && res.statusCode < 300));
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.on('error', () => {
        resolve(false);
      });

      req.write(payload);
      req.end();
    });
  } catch (err) {
    return false;
  }
}

/**
 * Sends presence state and keeps continuous heartbeats every 2.0s so WhatsApp never drops "digitando..."
 */
async function simulateActiveTyping(to, totalDurationMs, presenceType = 'composing', config = getConfig()) {
  const cleanPhone = normalizeRecipient(to);
  if (!cleanPhone) return;

  const startTime = Date.now();
  const scaledTotal = Math.max(1000, Math.round(totalDurationMs * config.timeScale));

  // Initial presence with full duration requested
  await sendPresenceRaw(cleanPhone, presenceType, scaledTotal, config);

  // Heartbeat loop: periodically refresh presence every 2.0s while typing so the indicator stays active
  while ((Date.now() - startTime) < scaledTotal) {
    const elapsed = Date.now() - startTime;
    const remaining = scaledTotal - elapsed;
    const chunk = Math.min(2000, remaining);
    await sleep(chunk, config);
    if ((Date.now() - startTime) < scaledTotal) {
      const newRemaining = scaledTotal - (Date.now() - startTime);
      sendPresenceRaw(cleanPhone, presenceType, Math.max(2500, newRemaining), config).catch(() => {});
    }
  }
}

async function sendPresence(to, presenceType = 'composing', durationMs = 0, config = getConfig()) {
  const cleanPhone = normalizeRecipient(to);
  if (!cleanPhone) return false;
  return sendPresenceRaw(cleanPhone, presenceType, durationMs || 3000, config);
}

// ─── LOW-LEVEL HTTP DISPATCH WITH EXPONENTIAL BACKOFF (R4) ───────────────────
function executeHttpRequest(urlStr, method, headers, payload, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(urlStr);
    const isHttps = urlObj.protocol === 'https:';
    const transport = isHttps ? https : http;

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: headers,
      timeout: timeoutMs
    };

    const req = transport.request(options, (res) => {
      let responseBody = '';
      res.on('data', chunk => { responseBody += chunk; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(responseBody); } catch (_) { parsed = responseBody; }

        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsed,
          rawBody: responseBody
        });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const err = new Error(`Request timed out after ${timeoutMs}ms`);
      err.code = 'ETIMEDOUT';
      reject(err);
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

function isRetryableError(statusCode, err) {
  if (err) {
    // Network errors, timeouts, resets are retryable
    const code = err.code || '';
    if (['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE', 'EAI_AGAIN', 'ENOTFOUND'].includes(code)) {
      return true;
    }
    if (err.message && err.message.includes('timed out')) {
      return true;
    }
  }

  if (statusCode) {
    // 429 (Rate Limit), 5xx (Server Faults) are retryable
    if (statusCode === 429 || (statusCode >= 500 && statusCode <= 599)) {
      return true;
    }
    // 4xx errors (e.g. 400 Bad Request, 401 Unauthorized, 404 Not Found) are non-retryable
    return false;
  }

  return false;
}

/**
 * Dispatches an outbound payload to Evolution API with exponential backoff & jitter.
 */
async function dispatchWithRetry(endpointPath, payloadObject, config = getConfig(), maxRetries = config.maxRetries) {
  const url = `${config.apiUrl}${endpointPath}`;
  const payloadString = JSON.stringify(payloadObject);
  const headers = {
    'apikey': config.apiKey,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payloadString)
  };

  let lastError = null;
  let lastResponse = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await executeHttpRequest(url, 'POST', headers, payloadString, 15000);
      lastResponse = response;

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return { success: true, attempt: attempt + 1, data: response.data };
      }

      // Check if status code is non-retryable client error (4xx except 429)
      if (!isRetryableError(response.statusCode, null)) {
        return {
          success: false,
          attempt: attempt + 1,
          statusCode: response.statusCode,
          error: `Non-retryable HTTP error ${response.statusCode}`,
          data: response.data
        };
      }

      lastError = new Error(`HTTP Error ${response.statusCode}: ${response.rawBody}`);
    } catch (err) {
      lastError = err;
      if (!isRetryableError(null, err)) {
        return { success: false, attempt: attempt + 1, error: err.message };
      }
    }

    // If more attempts remain, compute exponential backoff with jitter
    if (attempt < maxRetries) {
      const exponentialDelay = config.baseBackoffMs * Math.pow(2, attempt);
      const jitter = getRandomInt(0, 500);
      const delay = Math.min(config.maxBackoffMs, exponentialDelay + jitter);
      await sleep(delay, config);
    }
  }

  return {
    success: false,
    attempt: maxRetries + 1,
    statusCode: lastResponse ? lastResponse.statusCode : null,
    error: lastError ? lastError.message : 'Max retries exceeded'
  };
}

// ─── R1: PER-CONTACT FIFO QUEUE MANAGER ──────────────────────────────────────
class ContactQueue {
  constructor(phone, config) {
    this.phone = phone;
    this.config = config;
    this.items = [];
    this.isProcessing = false;
    this.idleTimer = null;
    this.lastDispatchTime = 0;
  }

  enqueue(item) {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    if (this.items.length >= this.config.maxQueueDepth) {
      const err = new Error(`Queue overflow: contact ${this.phone} exceeded max depth of ${this.config.maxQueueDepth}`);
      item.reject(err);
      return;
    }

    this.items.push(item);
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.items.length > 0) {
      const currentItem = this.items.shift();

      try {
        const result = await this.executeItem(currentItem);
        currentItem.resolve(result);
      } catch (err) {
        currentItem.reject(err);
      }

      this.lastDispatchTime = Date.now();

      // If more items exist in this contact's queue, enforce randomized inter-message delay (2-6s)
      if (this.items.length > 0) {
        const minDelay = currentItem.options.minInterval || this.config.minInterMessageDelay;
        const maxDelay = currentItem.options.maxInterval || this.config.maxInterMessageDelay;
        const interMessageDelay = getRandomInt(minDelay, maxDelay);
        await sleep(interMessageDelay, this.config);
      }
    }

    this.isProcessing = false;

    // Schedule idle cleanup
    this.idleTimer = setTimeout(() => {
      queueManager.evictIdleQueue(this.phone);
    }, Math.max(100, Math.round(this.config.idleQueueTimeoutMs * this.config.timeScale)));
  }

  async executeItem(item) {
    const config = this.config;
    const { type, payload, options } = item;

    // 1. Spintax & Dynamic Content Resolution
    let messageText = payload.text || '';
    if (type === 'text') {
      messageText = parseSpintax(messageText);
      messageText = formatToWhatsAppMarkdown(messageText);
    } else if (payload.caption) {
      payload.caption = parseSpintax(payload.caption);
      payload.caption = formatToWhatsAppMarkdown(payload.caption);
    }

    // 2. Realistic Human Typing & Reading Emulation (R2 Anti-Ban Extended)
    const targetRecipient = resolveTargetJid(this.phone);
    if (!options.skipPresence) {
      // Step A: Initial human reading / thinking pause when customer message arrives (5.0s - 9.0s)
      const readingDelay = options.initialDelay || getRandomInt(5000, 9000);
      await sleep(readingDelay, config);

      if (type === 'audio') {
        // Sustained Voice Recording Simulation (7s - 14s)
        const recordDuration = options.typingDelay || getRandomInt(7000, 14000);
        await simulateActiveTyping(targetRecipient, recordDuration, 'recording', config);
      } else {
        // Sustained Human Typing Simulation with Continuous Presence Heartbeats
        const totalTyping = options.typingDelay || calculateTypingDelay(
          type === 'text' ? messageText : (payload.caption || ''),
          type,
          config
        );

        // Phase 1: First sustained typing (min 6.0s, up to 12.0s)
        const phase1Duration = Math.max(6000, Math.round(totalTyping * 0.50));
        await simulateActiveTyping(targetRecipient, phase1Duration, 'composing', config);

        // Phase 2: Natural human pause / thinking / revising (2.0s - 4.0s)
        const pauseDuration = getRandomInt(2000, 4000);
        await sendPresenceRaw(normalizeRecipient(targetRecipient), 'paused', pauseDuration, config);
        await sleep(pauseDuration, config);

        // Phase 3: Second sustained typing (min 6.0s, up to 12.0s)
        const phase2Duration = Math.max(6000, totalTyping - phase1Duration);
        await simulateActiveTyping(targetRecipient, phase2Duration, 'composing', config);

        // Phase 4: Final human review pause before clicking send (2.5s - 5.0s)
        const postReviewPause = getRandomInt(2500, 5000);
        await sendPresenceRaw(normalizeRecipient(targetRecipient), 'paused', postReviewPause, config);
        await sleep(postReviewPause, config);
      }
    }

    // 3. Dispatch Message with Exponential Backoff (R4)
    let dispatchResult;
    if (type === 'text') {
      const textPayload = {
        number: targetRecipient,
        text: messageText
      };
      if (options.quoted) {
        textPayload.quoted = options.quoted;
      }
      dispatchResult = await dispatchWithRetry(
        `/message/sendText/${config.instance}`,
        textPayload,
        config,
        options.maxRetries || config.maxRetries
      );
    } else {
      // Media, document, audio, image
      const mediaPayload = {
        number: targetRecipient,
        mediatype: payload.mediaType || 'document',
        mimetype: payload.mimetype || (payload.mediaType === 'document' ? 'application/pdf' : 'image/jpeg'),
        media: payload.media,
        fileName: payload.fileName || (payload.mediaType === 'image' ? 'imagem.jpg' : 'documento.pdf'),
        caption: payload.caption || ''
      };
      if (options.quoted) {
        mediaPayload.quoted = options.quoted;
      }

      dispatchResult = await dispatchWithRetry(
        `/message/sendMedia/${config.instance}`,
        mediaPayload,
        config,
        options.maxRetries || config.maxRetries
      );
    }

    // 4. (Optional) Set presence back to paused
    if (!options.skipPresence) {
      sendPresence(targetRecipient, 'paused', 0, config).catch(() => {});
    }

    return dispatchResult;
  }
}

class QueueManager {
  constructor() {
    this.queues = new Map(); // phone -> ContactQueue
  }

  getQueue(phone, config = getConfig()) {
    const cleanPhone = normalizeRecipient(phone);
    if (!this.queues.has(cleanPhone)) {
      const newQueue = new ContactQueue(cleanPhone, config);
      this.queues.set(cleanPhone, newQueue);
    }
    return this.queues.get(cleanPhone);
  }

  evictIdleQueue(phone) {
    const queue = this.queues.get(phone);
    if (queue && !queue.isProcessing && queue.items.length === 0) {
      this.queues.delete(phone);
    }
  }

  getActiveQueues() {
    return this.queues;
  }

  clearAll() {
    for (const queue of this.queues.values()) {
      if (queue.idleTimer) clearTimeout(queue.idleTimer);
    }
    this.queues.clear();
  }

  getStats() {
    let totalPending = 0;
    let activeContacts = 0;
    for (const queue of this.queues.values()) {
      if (queue.isProcessing || queue.items.length > 0) activeContacts++;
      totalPending += queue.items.length;
    }
    return {
      activeContacts,
      totalPending,
      totalQueues: this.queues.size
    };
  }
}

const queueManager = new QueueManager();

// ─── PUBLIC ENQUEUE INTERFACE ───────────────────────────────────────────────
/**
 * Enqueues a message into the per-contact Anti-Ban queue.
 * Supports both object signature `{ to, type, payload, options }` and positional `(to, messageText, options)`.
 */
function enqueueMessage(arg1, messageText, options = {}) {
  let to = '';
  let type = 'text';
  let payload = {};
  let opts = {};

  if (arg1 && typeof arg1 === 'object' && !Array.isArray(arg1) && (arg1.to || arg1.payload)) {
    to = arg1.to;
    type = arg1.type || 'text';
    payload = arg1.payload || {};
    opts = arg1.options || {};
    if (typeof payload === 'string') payload = { text: payload };
    if (!payload.text && arg1.text) payload.text = arg1.text;
  } else {
    to = arg1;
    type = 'text';
    payload = { text: messageText };
    opts = options || {};
  }

  const cleanPhone = normalizeRecipient(to);
  if (!cleanPhone || (!payload.text && type === 'text' && !payload.media)) {
    return Promise.reject(new Error('Invalid parameters for enqueueMessage: "to" and message payload are required'));
  }

  const config = getConfig();
  const queue = queueManager.getQueue(cleanPhone, config);

  return new Promise((resolve, reject) => {
    queue.enqueue({
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: type,
      to: cleanPhone,
      payload: payload,
      options: opts,
      createdAt: Date.now(),
      resolve,
      reject
    });
  });
}

/**
 * Enqueues a media or document message into the per-contact Anti-Ban queue.
 * Supports both object signature and positional arguments.
 */
async function enqueueMedia(arg1, mediaUrlOrBase64, fileName, caption, mediaType = 'document', options = {}) {
  let to = '';
  let cleanMedia = '';
  let name = '';
  let cap = '';
  let type = 'document';
  let finalMimeType = '';
  let opts = {};

  if (arg1 && typeof arg1 === 'object' && !Array.isArray(arg1) && arg1.to) {
    to = arg1.to;
    opts = arg1.options || {};
    const p = arg1.payload || {};
    cleanMedia = p.mediaUrl || p.media || arg1.mediaUrl || arg1.media;
    name = p.fileName || arg1.fileName;
    cap = p.caption || arg1.caption;
    type = arg1.type || p.mediaType || arg1.mediaType || 'document';
    finalMimeType = p.mimetype || arg1.mimetype;
  } else {
    to = arg1;
    cleanMedia = mediaUrlOrBase64;
    name = fileName;
    cap = caption;
    type = mediaType || 'document';
    opts = options || {};
  }

  const cleanPhone = normalizeRecipient(to);
  if (!cleanPhone || !cleanMedia) {
    return Promise.reject(new Error('Invalid parameters for enqueueMedia: "to" and "media" are required'));
  }

  if (!finalMimeType) {
    finalMimeType = type === 'document' ? 'application/pdf' : (type === 'audio' ? 'audio/mp4' : 'image/jpeg');
  }

  // If HTTP URL, fetch and convert to base64 if needed, or pass directly
  if (typeof cleanMedia === 'string' && cleanMedia.startsWith('http')) {
    try {
      if (typeof fetch === 'function') {
        const resp = await fetch(cleanMedia, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (resp.ok) {
          const arrayBuffer = await resp.arrayBuffer();
          cleanMedia = Buffer.from(arrayBuffer).toString('base64');
          const ct = resp.headers.get('content-type');
          if (ct) finalMimeType = ct;
        }
      }
    } catch (e) {
      // Fallback: keep URL as cleanMedia
    }
  } else if (typeof cleanMedia === 'string' && cleanMedia.includes(';base64,')) {
    const parts = cleanMedia.split(';base64,');
    if (parts[0].includes('data:')) {
      finalMimeType = parts[0].replace('data:', '');
    }
    cleanMedia = parts[1];
  }

  const config = getConfig();
  const queue = queueManager.getQueue(cleanPhone, config);

  return new Promise((resolve, reject) => {
    queue.enqueue({
      id: `media_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: type === 'audio' ? 'audio' : 'media',
      to: cleanPhone,
      payload: {
        media: cleanMedia,
        fileName: name,
        caption: cap,
        mediaType: type,
        mimetype: finalMimeType
      },
      options: opts,
      createdAt: Date.now(),
      resolve,
      reject
    });
  });
}

// ─── DROP-IN BACKWARD COMPATIBILITY FACADES ──────────────────────────────────
function sendWhatsAppReply(to, messageText, retryCount = 0) {
  if (!messageText || !to) {
    console.error('❌ sendWhatsAppReply: parâmetros inválidos', { to, messageText: messageText ? 'ok' : 'vazio' });
    return Promise.resolve({ success: false, error: 'Invalid parameters' });
  }

  return enqueueMessage(to, messageText).then(res => {
    if (res && res.success) {
      console.log(`✅ Mensagem entregue via Anti-Ban Shield para ${normalizeRecipient(to)}`);
    } else {
      console.error(`❌ Falha na entrega Anti-Ban Shield para ${normalizeRecipient(to)}:`, res ? res.error : 'Unknown error');
    }
    return res;
  }).catch(err => {
    console.error(`❌ Erro no envio Anti-Ban Shield para ${normalizeRecipient(to)}:`, err.message);
    return { success: false, error: err.message };
  });
}

async function sendWhatsAppMedia(to, mediaUrl, fileName, caption, mediaType = 'document') {
  if (!mediaUrl || !to) return { success: false, error: 'Invalid parameters' };

  try {
    const res = await enqueueMedia(to, mediaUrl, fileName, caption, mediaType);
    if (res && res.success) {
      console.log(`✅ Mídia entregue via Anti-Ban Shield para ${normalizeRecipient(to)}`);
    } else {
      console.error(`❌ Falha na mídia Anti-Ban Shield para ${normalizeRecipient(to)}:`, res ? res.error : 'Unknown error');
    }
    return res;
  } catch (err) {
    console.error(`❌ Erro no envio de mídia Anti-Ban Shield para ${normalizeRecipient(to)}:`, err.message);
    return { success: false, error: err.message };
  }
}

// ─── MODULE EXPORTS ─────────────────────────────────────────────────────────
module.exports = {
  getConfig,
  sleep,
  normalizeRecipient,
  registerContactContext,
  resolveTargetJid,
  getContactContext,
  loadLidMappingsFromDb,
  parseSpintax,
  getDynamicGreeting,
  formatToWhatsAppMarkdown,
  calculateTypingDelay,
  sendPresence,
  dispatchWithRetry,
  enqueueMessage,
  enqueueMedia,
  sendWhatsAppReply,
  sendWhatsAppMedia,
  queueManager,
  getQueueStats: () => queueManager.getStats(),
  clearAllQueues: () => queueManager.clearAll()
};
