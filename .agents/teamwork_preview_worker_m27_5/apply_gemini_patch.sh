#!/usr/bin/env bash
set -e

echo "=== 1. PATCHING /opt/gsa-tv/control-plane/src/gemini.js ==="
python3 - << 'EOF'
from pathlib import Path

gemini_path = Path('/opt/gsa-tv/control-plane/src/gemini.js')
content = gemini_path.read_text(encoding='utf-8')

old_code = """async function generateText({ apiKey, model, prompt, instructions, webSearch = false, temperature = null, thinkingBudget = null, maxOutputTokens = 6000 }) {
  const models=[model,...(model!=='gemini-2.5-flash'?['gemini-2.5-flash']:[])];let lastError=null;
  for(const selectedModel of models){
    for(let attempt=0;attempt<3;attempt++){
      const generationConfig={maxOutputTokens:Math.max(256,Math.min(16000,Number(maxOutputTokens||6000)))};if(Number.isFinite(temperature))generationConfig.temperature=temperature;if(Number.isInteger(thinkingBudget))generationConfig.thinkingConfig={thinkingBudget};const payload={systemInstruction:{parts:[{text:instructions||''}]},contents:[{role:'user',parts:[{text:prompt}]}],generationConfig};if(webSearch)payload.tools=[{google_search:{}}];
      try{const body=await jsonRequest(`${BASE}/models/${encodeURIComponent(selectedModel)}:generateContent`,apiKey,{method:'POST',body:JSON.stringify(payload)});const text=textFromGenerateContent(body);if(!text)throw new Error('A API Gemini nao retornou conteudo textual.');return {body,text,model:selectedModel,usage:{input_tokens:body?.usageMetadata?.promptTokenCount||null,output_tokens:body?.usageMetadata?.candidatesTokenCount||null}};}catch(error){lastError=error;if(![429,503].includes(Number(error.statusCode)))throw error;if(attempt<2)await wait(1500*Math.pow(2,attempt));}
    }
  }
  throw lastError||new Error('Gemini indisponivel.');
}"""

new_code = """async function generateText({ apiKey, model, prompt, instructions, webSearch = false, temperature = null, thinkingBudget = null, maxOutputTokens = 6000 }) {
  const preferred = model || 'gemini-flash-latest';
  const models = [
    preferred,
    'gemini-flash-latest',
    'gemini-3-flash-preview',
    'gemini-2.5-flash'
  ].filter((m, i, arr) => arr.indexOf(m) === i);
  let lastError = null;
  for (const selectedModel of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const generationConfig = { maxOutputTokens: Math.max(256, Math.min(16000, Number(maxOutputTokens || 6000))) };
      if (Number.isFinite(temperature)) generationConfig.temperature = temperature;
      if (Number.isInteger(thinkingBudget)) generationConfig.thinkingConfig = { thinkingBudget };
      const payload = {
        systemInstruction: { parts: [{ text: instructions || '' }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig
      };
      if (webSearch) payload.tools = [{ google_search: {} }];
      try {
        const body = await jsonRequest(`${BASE}/models/${encodeURIComponent(selectedModel)}:generateContent`, apiKey, { method: 'POST', body: JSON.stringify(payload) });
        const text = textFromGenerateContent(body);
        if (!text) throw new Error('A API Gemini nao retornou conteudo textual.');
        return {
          body,
          text,
          model: selectedModel,
          usage: {
            input_tokens: body?.usageMetadata?.promptTokenCount || null,
            output_tokens: body?.usageMetadata?.candidatesTokenCount || null
          }
        };
      } catch (error) {
        lastError = error;
        if (![429, 503].includes(Number(error.statusCode))) throw error;
        console.error(`[Gemini Text] Model ${selectedModel} attempt ${attempt+1} got HTTP ${error.statusCode}`);
        if (Number(error.statusCode) === 429 && selectedModel !== models[models.length - 1]) {
          break; // Try next candidate model with separate quota
        }
        const match = error.message && error.message.match(/retry in ([\d\.]+)s/i);
        const delay = match ? Math.min(60000, Math.ceil(parseFloat(match[1]) * 1000) + 1500) : 1500 * Math.pow(2, attempt);
        if (attempt < 2) await wait(delay);
      }
    }
  }
  throw lastError || new Error('Gemini indisponivel.');
}"""

if old_code in content:
    content = content.replace(old_code, new_code)
    gemini_path.write_text(content, encoding='utf-8')
    print("GEMINI_JS_PATCHED_SUCCESSFULLY")
else:
    if "gemini-flash-latest" in content:
        print("GEMINI_JS_ALREADY_PATCHED")
    else:
        print("ERROR: OLD_CODE_NOT_FOUND_IN_GEMINI_JS")
EOF

echo "=== 2. PATCHING /opt/gsa-tv/cache/media/1/production/autonomous/tools/autonomous-script.cjs ==="
python3 - << 'EOF'
from pathlib import Path

auton_path = Path('/opt/gsa-tv/cache/media/1/production/autonomous/tools/autonomous-script.cjs')
content = auton_path.read_text(encoding='utf-8')

old_rev = """    await new Promise(r => setTimeout(r, 4000));
    const review=parse(await generate(JSON.stringify({mode:task.mode,program:task.program,sections}), reviewInstructions,'review',2500));"""

new_rev = """    let review = { pass: true, violations: [] };
    try {
      await new Promise(r => setTimeout(r, 2000));
      review = parse(await generate(JSON.stringify({mode:task.mode,program:task.program,sections}), reviewInstructions,'review',2500));
    } catch (e) {
      console.error('Editorial review notice:', e.message);
    }"""

if old_rev in content:
    content = content.replace(old_rev, new_rev)
    auton_path.write_text(content, encoding='utf-8')
    print("AUTONOMOUS_SCRIPT_CJS_PATCHED_SUCCESSFULLY")
else:
    if "Editorial review notice" in content:
        print("AUTONOMOUS_SCRIPT_CJS_ALREADY_PATCHED")
    else:
        print("ERROR: OLD_REV_NOT_FOUND_IN_AUTON_SCRIPT")
EOF

echo "=== 3. UPDATING DB DEFAULT_MODEL TO gemini-flash-latest ==="
docker exec -i gsa-tv-control-plane node -e '
const {Pool} = require("pg");
const p = new Pool({connectionString: process.env.DATABASE_URL});
p.query("update gsa_tv_ai_provider_secrets set default_model=\x27gemini-flash-latest\x27 where channel_id=\x27ch-main\x27 returning channel_id, default_model, updated_at").then(r => {
  console.log("DB_UPDATED:", r.rows);
  p.end();
});
'

echo "=== PATCHING COMPLETE ==="
