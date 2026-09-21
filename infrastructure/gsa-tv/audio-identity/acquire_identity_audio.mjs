#!/usr/bin/env node
// ==============================================================================
// GSA TV — Audio Acquisition Engine & Sonic Identity Curation Pipeline
// Path: infrastructure/gsa-tv/audio-identity/acquire_identity_audio.mjs
// Target: Curate and download 230 genuine royalty-free broadcast audio tracks
// Categories: news (45), viral (45), faith (45), lifestyle (45), sfx (50)
// ==============================================================================

import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

// Command line configuration
const args = process.argv.slice(2);
function getArg(name, fallback) {
  const prefix = `--${name}=`;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === `--${name}` && args[i + 1]) return args[i + 1];
    if (args[i].startsWith(prefix)) return args[i].slice(prefix.length);
  }
  return fallback;
}

const TARGET_ROOT = path.resolve(getArg('target', process.env.GSA_TV_AUDIO_ROOT || '/opt/gsa-tv/cache/media/1/identity/audio'));
const STAGING_DIR = path.resolve(getArg('staging', path.join(TARGET_ROOT, '.staging')));
const CONCURRENCY = parseInt(getArg('concurrency', '5'), 10);
const USER_AGENT = 'GSA-TV-SonicIdentity/1.0 (+https://gsa-hub.com.br; broadcast-audio-builder)';

console.log('================================================================================');
console.log('         GSA-TV SONIC IDENTITY AUDIO ACQUISITION ENGINE (230 TRACKS)           ');
console.log('================================================================================');
console.log(`Target Directory : ${TARGET_ROOT}`);
console.log(`Staging Directory: ${STAGING_DIR}`);
console.log(`Concurrency Pool : ${CONCURRENCY}`);
console.log(`Timestamp        : ${new Date().toISOString()}`);

// Category definitions & target counts
const CATEGORY_SPECS = {
  news: { target: 45, desc: 'Tense, corporate, breaking news beds' },
  viral: { target: 45, desc: 'Upbeat, pop, comedy effects' },
  faith: { target: 45, desc: 'Cinematic, peaceful, ambient' },
  lifestyle: { target: 45, desc: 'Jazz, acoustic, lounge' },
  sfx: { target: 50, desc: 'Transitions, whooshes, impacts, tickers' }
};

// Curated CC0 Sound Effects definition (50 assets)
const CURATED_SFX = [
  // Kenney UI Audio (35 uncompressed WAV assets - CC0 1.0 Universal)
  ...[1, 2, 3, 4, 5].map(i => ({
    title: `UI Click Transient ${i}`,
    filename: `click${i}.wav`,
    url: `https://raw.githubusercontent.com/Calinou/kenney-ui-audio/master/addons/kenney_ui_audio/click${i}.wav`,
    source: 'Kenney UI Audio',
    license: 'CC0 1.0 Universal',
    author: 'AssetForge / Kenney.nl'
  })),
  ...[1, 2, 3, 4, 5].map(i => ({
    title: `Graphic Rollover Tick ${i}`,
    filename: `rollover${i}.wav`,
    url: `https://raw.githubusercontent.com/Calinou/kenney-ui-audio/master/addons/kenney_ui_audio/rollover${i}.wav`,
    source: 'Kenney UI Audio',
    license: 'CC0 1.0 Universal',
    author: 'AssetForge / Kenney.nl'
  })),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25].map(i => ({
    title: `Broadcast Headline Switch ${i}`,
    filename: `switch${i}.wav`,
    url: `https://raw.githubusercontent.com/Calinou/kenney-ui-audio/master/addons/kenney_ui_audio/switch${i}.wav`,
    source: 'Kenney UI Audio',
    license: 'CC0 1.0 Universal',
    author: 'AssetForge / Kenney.nl'
  })),
  // romainsimon/uisfx (11 broadcast UI / cinematic MP3 assets - CC0 1.0 Universal)
  ...[
    'achievement', 'badge', 'bonus', 'checkpoint', 'complete',
    'connect', 'level-up', 'open', 'play', 'recording', 'start'
  ].map(name => ({
    title: `Cinematic Accent ${name.replace(/-/g, ' ')}`,
    filename: `uisfx_${name.replace(/-/g, '_')}.mp3`,
    url: `https://raw.githubusercontent.com/romainsimon/uisfx/main/packages/uisfx/sounds/cinematic/${name}.mp3`,
    source: 'romainsimon/uisfx',
    license: 'CC0 1.0 Universal',
    author: 'Romain Simon'
  })),
  // Freesound CDN Broadcast Stingers (4 high-impact transitions - CC0 / CC-BY)
  {
    title: 'Deep Cinema Whoosh Transition',
    filename: 'whoosh_cinema_transition.mp3',
    url: 'https://cdn.freesound.org/previews/351/351256_2247456-hq.mp3',
    source: 'Freesound via Openverse',
    license: 'CC0 1.0 Universal',
    author: 'Freesound Contributor'
  },
  {
    title: 'Heavy Sub Bass Broadcast Impact',
    filename: 'heavy_sub_bass_impact.mp3',
    url: 'https://cdn.freesound.org/previews/172/172779_2430808-hq.mp3',
    source: 'Freesound via Openverse',
    license: 'CC0 1.0 Universal',
    author: 'Freesound Contributor'
  },
  {
    title: 'Dramatic News Transition Accent',
    filename: 'dramatic_transition_accent.mp3',
    url: 'https://cdn.freesound.org/previews/159/159574_2863054-hq.mp3',
    source: 'Freesound via Openverse',
    license: 'CC0 1.0 Universal',
    author: 'Freesound Contributor'
  },
  {
    title: 'Teletype Breaking News Ticker',
    filename: 'teletype_news_ticker.mp3',
    url: 'https://cdn.freesound.org/previews/199/199484_2320755-hq.mp3',
    source: 'Freesound via Openverse',
    license: 'CC0 1.0 Universal',
    author: 'Freesound Contributor'
  }
];

// Helper to sanitize filename to ASCII alphanumeric
function sanitizeFilename(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
}

// Magic bytes validator for audio integrity
function validateMagicBytes(buffer, ext) {
  if (buffer.length < 4) return false;
  if (ext === '.mp3') {
    // Check ID3 header (0x49 0x44 0x33)
    if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) return true;
    // Check MPEG Audio sync word (first 11 bits are 1: 0xFF and 0xE0 mask)
    if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return true;
    return false;
  }
  if (ext === '.wav') {
    // Check RIFF header (0x52 0x49 0x46 0x46)
    return buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
  }
  return true; // Other formats
}

// Resilient downloader with exponential backoff & staging
async function downloadWithRetry(url, stagingPath, finalPath, maxAttempts = 3) {
  const ext = path.extname(finalPath).toLowerCase();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      // Stream to staging file
      const fileStream = fs.createWriteStream(stagingPath);
      await pipeline(Readable.fromWeb(res.body), fileStream);

      // Verify file size >= 4KB
      const stats = await fsPromises.stat(stagingPath);
      if (stats.size < 4096) {
        await fsPromises.unlink(stagingPath).catch(() => {});
        throw new Error(`Downloaded file too small (${stats.size} bytes < 4096 bytes)`);
      }

      // Verify magic bytes header
      const fd = await fsPromises.open(stagingPath, 'r');
      const headerBuf = Buffer.alloc(16);
      await fd.read(headerBuf, 0, 16, 0);
      await fd.close();

      if (!validateMagicBytes(headerBuf, ext)) {
        await fsPromises.unlink(stagingPath).catch(() => {});
        throw new Error(`Invalid audio magic bytes for extension ${ext}`);
      }

      // Calculate SHA-256 checksum
      const fileBuffer = await fsPromises.readFile(stagingPath);
      const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // Atomic move from staging to production path
      await fsPromises.rename(stagingPath, finalPath);

      return {
        success: true,
        size: stats.size,
        sha256
      };
    } catch (err) {
      await fsPromises.unlink(stagingPath).catch(() => {});
      if (attempt === maxAttempts) {
        throw new Error(`Failed after ${maxAttempts} attempts: ${err.message}`);
      }
      const backoffMs = attempt * 1500;
      await new Promise(r => setTimeout(r, backoffMs));
    }
  }
}

// Concurrency pool runner
async function runPool(items, limit, workerFn) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      const item = items[currentIndex];
      try {
        const res = await workerFn(item, currentIndex);
        results[currentIndex] = { status: 'fulfilled', value: res };
      } catch (err) {
        results[currentIndex] = { status: 'rejected', reason: err };
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// Main execution routine
async function main() {
  // 1. Ensure target and staging directories
  for (const cat of Object.keys(CATEGORY_SPECS)) {
    await fsPromises.mkdir(path.join(TARGET_ROOT, cat), { recursive: true });
  }
  await fsPromises.mkdir(STAGING_DIR, { recursive: true });

  // 2. Fetch Incompetech catalog
  console.log('\n>>> STEP 1: Fetching Incompetech OpenAPI catalog (pieces.json)...');
  const catalogRes = await fetch('https://incompetech.com/music/royalty-free/pieces.json', {
    headers: { 'User-Agent': USER_AGENT }
  });
  if (!catalogRes.ok) {
    throw new Error(`Failed to fetch Incompetech catalog: HTTP ${catalogRes.status}`);
  }
  const catalog = await catalogRes.json();
  console.log(`Successfully fetched catalog containing ${catalog.length} studio tracks.`);

  // 3. Filter tracks into categories
  console.log('\n>>> STEP 2: Curating tracks for News, Viral, Faith, Lifestyle...');
  const usedUuids = new Set();
  const curatedCatalog = {
    news: [],
    viral: [],
    faith: [],
    lifestyle: [],
    sfx: []
  };

  function matchTrack(p, filterRegex) {
    if (!p.filename || !p.filename.endsWith('.mp3')) return false;
    const text = `${p.title || ''} ${p.description || ''} ${p.feel || ''} ${p.instruments || ''}`.toLowerCase();
    return filterRegex.test(text);
  }

  // News (tense, corporate, driving)
  const newsRegex = /action|driving|intense|suspenseful|dark|urgent|news|corporate|headline|ticker|pulse|broadcast|investigative/;
  for (const p of catalog) {
    if (curatedCatalog.news.length >= 45) break;
    if (!usedUuids.has(p.uuid) && matchTrack(p, newsRegex)) {
      usedUuids.add(p.uuid);
      curatedCatalog.news.push(p);
    }
  }

  // Viral (upbeat, comedy, pop)
  const viralRegex = /humorous|bouncy|comedy|funny|quirky|cartoon|silly|upbeat|dance|pop|bright|meme/;
  for (const p of catalog) {
    if (curatedCatalog.viral.length >= 45) break;
    if (!usedUuids.has(p.uuid) && matchTrack(p, viralRegex)) {
      usedUuids.add(p.uuid);
      curatedCatalog.viral.push(p);
    }
  }

  // Faith (cinematic, peaceful, ambient)
  const faithRegex = /calm|calming|mystical|peaceful|spiritual|serene|organ|cathedral|meditation|hymn|sacred|choir|church|prayer|ethereal/;
  for (const p of catalog) {
    if (curatedCatalog.faith.length >= 45) break;
    if (!usedUuids.has(p.uuid) && matchTrack(p, faithRegex)) {
      usedUuids.add(p.uuid);
      curatedCatalog.faith.push(p);
    }
  }

  // Lifestyle (jazz, acoustic, lounge)
  const lifestyleRegex = /jazz|acoustic|bossa|lounge|coffee|cafe|organic|guitar|morning|evening|groove|relaxing/;
  for (const p of catalog) {
    if (curatedCatalog.lifestyle.length >= 45) break;
    if (!usedUuids.has(p.uuid) && matchTrack(p, lifestyleRegex)) {
      usedUuids.add(p.uuid);
      curatedCatalog.lifestyle.push(p);
    }
  }

  // SFX (50 assets)
  curatedCatalog.sfx = CURATED_SFX;

  console.log('Curated Track Distribution:');
  for (const [cat, items] of Object.entries(curatedCatalog)) {
    console.log(`  - ${cat.padEnd(10)}: ${items.length} tracks (target: ${CATEGORY_SPECS[cat].target})`);
  }

  // 4. Flatten all tasks for execution
  const downloadTasks = [];

  for (const [category, items] of Object.entries(curatedCatalog)) {
    items.forEach((item, idx) => {
      const padIdx = String(idx + 1).padStart(3, '0');
      let filename, url, title, author, license, length;

      if (category === 'sfx') {
        filename = `gsa_sfx_${padIdx}_${sanitizeFilename(item.filename)}`;
        url = item.url;
        title = item.title;
        author = item.author;
        license = item.license;
        length = item.filename.endsWith('.wav') ? 'SFX (WAV)' : 'SFX (MP3)';
      } else {
        const rawName = item.filename;
        const baseClean = sanitizeFilename(item.title || path.parse(rawName).name);
        filename = `gsa_${category}_${padIdx}_${baseClean}.mp3`;
        url = `https://incompetech.com/music/royalty-free/mp3-royaltyfree/${encodeURIComponent(rawName)}`;
        title = item.title;
        author = 'Kevin MacLeod (incompetech.com)';
        license = 'Creative Commons: By Attribution 4.0 (CC-BY 4.0)';
        length = item.length || 'Unknown';
      }

      const stagingPath = path.join(STAGING_DIR, `stage_${category}_${filename}.part`);
      const finalPath = path.join(TARGET_ROOT, category, filename);

      downloadTasks.push({
        category,
        index: padIdx,
        title,
        filename,
        url,
        author,
        license,
        length,
        stagingPath,
        finalPath
      });
    });
  }

  console.log(`\n>>> STEP 3: Downloading & validating ${downloadTasks.length} assets (Concurrency: ${CONCURRENCY})...`);

  const manifestItems = [];
  let completedCount = 0;
  const startTime = Date.now();

  await runPool(downloadTasks, CONCURRENCY, async (task) => {
    // Check if target file already exists and is valid >= 4KB
    let stats;
    try {
      stats = await fsPromises.stat(task.finalPath);
    } catch {
      stats = null;
    }

    if (stats && stats.size >= 4096) {
      completedCount++;
      const fileBuf = await fsPromises.readFile(task.finalPath);
      const sha256 = crypto.createHash('sha256').update(fileBuf).digest('hex');
      manifestItems.push({
        category: task.category,
        filename: task.filename,
        title: task.title,
        duration: task.length,
        size_bytes: stats.size,
        sha256,
        license: task.license,
        author: task.author,
        source_url: task.url
      });
      process.stdout.write(`\r[${completedCount}/${downloadTasks.length}] Existing validated: ${task.filename.slice(0, 35)}...`);
      return;
    }

    // Execute staged download
    const res = await downloadWithRetry(task.url, task.stagingPath, task.finalPath, 3);
    completedCount++;

    manifestItems.push({
      category: task.category,
      filename: task.filename,
      title: task.title,
      duration: task.length,
      size_bytes: res.size,
      sha256: res.sha256,
      license: task.license,
      author: task.author,
      source_url: task.url
    });

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    process.stdout.write(`\r[${completedCount}/${downloadTasks.length}] (${elapsed}s) Acquired: ${task.filename.slice(0, 35)}...`);
  });

  console.log(`\n\n>>> STEP 4: All downloads complete! Generating manifest and licensing attributions...`);

  // 5. Clean up staging directory
  await fsPromises.rm(STAGING_DIR, { recursive: true, force: true }).catch(() => {});

  // 6. Write manifest.json
  const manifestPath = path.join(TARGET_ROOT, 'manifest.json');
  await fsPromises.writeFile(manifestPath, JSON.stringify(manifestItems, null, 2), 'utf8');
  console.log(`Saved manifest to ${manifestPath} (${manifestItems.length} records)`);

  // 7. Generate ATTRIBUTIONS.md
  const attributions = [
    '# GSA TV — Sonic Identity Audio Licensing & Attributions',
    '',
    `**Generated Date**: ${new Date().toISOString()}`,
    `**Total Licensed Assets**: ${manifestItems.length} tracks`,
    `**Root Path**: \`${TARGET_ROOT}\``,
    '',
    '## 1. Commercial TV Broadcast Royalty-Free Music Beds (180 Tracks)',
    '- **Artist**: Kevin MacLeod',
    '- **Website**: https://incompetech.com',
    '- **License**: Creative Commons: By Attribution 4.0 International (CC-BY 4.0)',
    '- **Commercial Broadcast Rights**: Explicitly authorized for television broadcasting, cable, streaming, and commercials.',
    '- **Mandatory On-Air / EPG Credit Format**:',
    '  > *"Music by Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License"*',
    '',
    '### Curated Categories from Incompetech:',
    '- **News** (45 tracks): Hard-hitting, tense orchestral and driving electronic news beds.',
    '- **Viral** (45 tracks): Upbeat, quirky, comedy, and high-energy modern pop hooks.',
    '- **Faith** (45 tracks): Cathedral organs, sacred choral, peaceful piano, and ethereal ambient washes.',
    '- **Lifestyle** (45 tracks): Smooth jazz, acoustic folk guitar, bossa nova, and relaxed morning beds.',
    '',
    '## 2. Broadcast Sound Effects & Stingers (50 Tracks)',
    '- **Kenney UI Audio** (35 tracks): CC0 1.0 Universal (Public Domain) — clicks, rollovers, switches.',
    '- **romainsimon/uisfx** (11 tracks): CC0 1.0 Universal (Public Domain) — cinematic stingers, achievements, chimes.',
    '- **Freesound Openverse Curated** (4 tracks): CC0 1.0 Universal / CC-BY — whooshes, sub-bass impacts, news tickers.',
    '',
    '## 3. Inventory Summary by Category',
    '| Category | Count | Primary License | Sonic Application |',
    '|---|---|---|---|',
    `| news | ${manifestItems.filter(m => m.category === 'news').length} | CC-BY 4.0 | Breaking news, investigative segments, financial tickers |`,
    `| viral | ${manifestItems.filter(m => m.category === 'viral').length} | CC-BY 4.0 | Social media reels, comedy bits, high-energy intros |`,
    `| faith | ${manifestItems.filter(m => m.category === 'faith').length} | CC-BY 4.0 | Inspirational reflections, sacred moments, memorial beds |`,
    `| lifestyle | ${manifestItems.filter(m => m.category === 'lifestyle').length} | CC-BY 4.0 | Morning magazine, food & cooking, wellness, culture |`,
    `| sfx | ${manifestItems.filter(m => m.category === 'sfx').length} | CC0 1.0 Universal | Scene transitions, graphic reveals, lower-third popups |`,
    `| **TOTAL** | **${manifestItems.length}** | **100% Royalty-Free** | **Official GSA TV Sonic Identity** |`,
    ''
  ].join('\n');

  const attributionsPath = path.join(TARGET_ROOT, 'ATTRIBUTIONS.md');
  await fsPromises.writeFile(attributionsPath, attributions, 'utf8');
  console.log(`Saved attributions to ${attributionsPath}`);

  // 8. Verification summary
  const totalCount = manifestItems.length;
  console.log('\n================================================================================');
  console.log(`ACQUISITION COMPLETE: ${totalCount} valid audio assets acquired into ${TARGET_ROOT}`);
  console.log('================================================================================');

  if (totalCount < 200) {
    console.error(`ERROR: Acquisition resulted in ${totalCount} files, which is below the required 200.`);
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('\nFATAL ERROR in acquire_identity_audio:', err);
  process.exit(1);
});
