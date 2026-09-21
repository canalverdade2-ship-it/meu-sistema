const fs = require('fs');

let app = fs.readFileSync('scratch/app.js', 'utf8');

// Patch 1: Filler fallback
app = app.replace(
  /const fillerDuration = await probeDurationSeconds\(SCHEDULE_FILLER_FILE\);/g,
  `let fillerDuration = 600;
  try {
    fillerDuration = await probeDurationSeconds(SCHEDULE_FILLER_FILE);
  } catch (err) {
    console.error("Erro ao fazer probe do filler, usando fallback de 600s:", err.message);
  }`
);

// Patch 2: SERVICE_URLS
app = app.replace(
  /const SERVICE_URLS = \{ ffplayout: \`\$\{FFPLAYOUT_URL\}\/\` \};/g,
  'const SERVICE_URLS = { ffplayout: `${FFPLAYOUT_URL}/`, encoderEngine: "http://127.0.0.1:9210" };'
);

// Patch 3: Telemetry
app = app.replace(
  /let playoutError = null;\s+try \{\s+playoutStatus = await ffplayoutProcess\("status"\);\s+\} catch \(error\) \{\s+playoutError = error\.message;\s+\}/g,
  `let playoutError = null;
  try {
    playoutStatus = await ffplayoutProcess("status");
  } catch (error) {
    playoutError = error.message;
  }
  // --- PATCH: Buscar telemetria real do encoder ---
  try {
    const encRes = await fetch("http://127.0.0.1:9210/v1/status", {
      headers: { Authorization: \`Bearer \${INTERNAL_API_TOKEN}\` },
    });
    if (encRes.ok) {
      const encData = await encRes.json();
      if (encData.outer_running === false || encData.producer_running === false) {
        streamState.actual = "stopped";
      }
    }
  } catch (err) {}
  // --- FIM PATCH ---`
);

fs.writeFileSync('scratch/app_patched.js', app, 'utf8');
console.log('Patch complete.');
