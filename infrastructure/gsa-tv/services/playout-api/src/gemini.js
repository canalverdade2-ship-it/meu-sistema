"use strict";

const BASE = "https://generativelanguage.googleapis.com/v1beta";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function jsonRequest(url, apiKey, init = {}, timeout = 240000) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "x-goog-api-key": apiKey,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(timeout),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.error?.message || body?.message || `HTTP ${response.status}`;
    const error = new Error(`Gemini API ${response.status}: ${message}`); error.statusCode=response.status; throw error;
  }
  return body;
}

function textFromGenerateContent(body) {
  return (body?.candidates || [])
    .flatMap((candidate) => candidate?.content?.parts || [])
    .map((part) => part?.text || "")
    .filter(Boolean)
    .join("\n");
}
async function generateText({ apiKey, model, prompt, instructions, webSearch = false }) {
  const models=[model,...(model!=='gemini-2.5-flash'?['gemini-2.5-flash']:[])];let lastError=null;
  for(const selectedModel of models){
    for(let attempt=0;attempt<3;attempt++){
      const payload={systemInstruction:{parts:[{text:instructions||''}]},contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:6000}};if(webSearch)payload.tools=[{google_search:{}}];
      try{const body=await jsonRequest(`${BASE}/models/${encodeURIComponent(selectedModel)}:generateContent`,apiKey,{method:'POST',body:JSON.stringify(payload)});const text=textFromGenerateContent(body);if(!text)throw new Error('A API Gemini nao retornou conteudo textual.');return {body,text,model:selectedModel,usage:{input_tokens:body?.usageMetadata?.promptTokenCount||null,output_tokens:body?.usageMetadata?.candidatesTokenCount||null}};}catch(error){lastError=error;if(![429,503].includes(Number(error.statusCode)))throw error;if(attempt<2)await wait(1500*Math.pow(2,attempt));}
    }
  }
  throw lastError||new Error('Gemini indisponivel.');
}

async function reviewImages({ apiKey, model, images, prompt, instructions }) {
  if (!Array.isArray(images) || images.length < 1 || images.length > 8)
    throw new Error("A revisão visual exige entre 1 e 8 imagens.");
  const models = [model, ...(model !== "gemini-2.5-flash" ? ["gemini-2.5-flash"] : [])];
  let lastError = null;
  for (const selectedModel of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const parts = [
        ...images.map((image) => ({
          inlineData: {
            mimeType: image.mimeType || "image/jpeg",
            data: Buffer.isBuffer(image.buffer)
              ? image.buffer.toString("base64")
              : String(image.data || ""),
          },
        })),
        { text: prompt || "" },
      ];
      const payload = {
        systemInstruction: { parts: [{ text: instructions || "" }] },
        contents: [{ role: "user", parts }],
        generationConfig: { maxOutputTokens: 2000 },
      };
      try {
        const body = await jsonRequest(
          `${BASE}/models/${encodeURIComponent(selectedModel)}:generateContent`,
          apiKey,
          { method: "POST", body: JSON.stringify(payload) },
          180000,
        );
        const text = textFromGenerateContent(body);
        if (!text) throw new Error("A API Gemini não retornou revisão visual.");
        return {
          body,
          text,
          model: selectedModel,
          usage: {
            input_tokens: body?.usageMetadata?.promptTokenCount || null,
            output_tokens: body?.usageMetadata?.candidatesTokenCount || null,
          },
        };
      } catch (error) {
        lastError = error;
        if (![429, 503].includes(Number(error.statusCode))) throw error;
        if (attempt < 2) await wait(1500 * Math.pow(2, attempt));
      }
    }
  }
  throw lastError || new Error("Gemini indisponível para revisão visual.");
}

function findInteractionBlock(body, type) {
  if (type === "image" && body?.output_image?.data) return body.output_image;
  if (type === "audio" && body?.output_audio?.data) return body.output_audio;
  for (const step of body?.steps || []) {
    for (const block of step?.content || []) if (block?.type === type && block?.data) return block;
  }
  return null;
}
async function generateImage({ apiKey, model, prompt }) {
  const body = await jsonRequest(`${BASE}/interactions`, apiKey, {
    method: "POST",
    body: JSON.stringify({
      model,
      input: prompt,
      response_format: { type: "image", aspect_ratio: "16:9", image_size: "1K" },
    }),
  }, 300000);
  const image = findInteractionBlock(body, "image");
  if (!image?.data) throw new Error("A API Gemini não retornou imagem.");
  return {
    buffer: Buffer.from(image.data, "base64"),
    mimeType: image.mime_type || image.mimeType || "image/png",
    metadata: { interaction_id: body?.id || null, model },
  };
}

function pcm16ToWav(pcm, sampleRate = 24000, channels = 1) {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * 2;
  header.write("RIFF", 0); header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVEfmt ", 8); header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(channels * 2, 32); header.writeUInt16LE(16, 34);
  header.write("data", 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
async function generateSpeech({ apiKey, model, text, voice = "Kore" }) {
  const body = await jsonRequest(`${BASE}/interactions`, apiKey, {
    method: "POST",
    headers: { "Api-Revision": "2026-05-20" },
    body: JSON.stringify({
      model,
      input: `Sintetize em português do Brasil, com clareza de broadcast. Texto falado:\n${text}`,
      response_format: { type: "audio" },
      generation_config: { speech_config: [{ voice }] },
    }),
  }, 300000);
  const audio = findInteractionBlock(body, "audio");
  if (!audio?.data) throw new Error("A API Gemini não retornou áudio.");
  const raw = Buffer.from(audio.data, "base64");
  const mime = String(audio.mime_type || audio.mimeType || "audio/pcm");
  return {
    buffer: /wav/i.test(mime) ? raw : pcm16ToWav(raw, 24000, 1),
    mimeType: "audio/wav",
    metadata: { interaction_id: body?.id || null, model, voice },
  };
}

async function generateVideo({ apiKey, model, prompt }) {
  const operation = await jsonRequest(
    `${BASE}/models/${encodeURIComponent(model)}:predictLongRunning`, apiKey,
    { method: "POST", body: JSON.stringify({ instances: [{ prompt }], parameters: { numberOfVideos: 1, resolution: "720p", aspectRatio: "16:9" } }) },
    180000,
  );
  if (!operation?.name) throw new Error("Veo não retornou identificador de operação.");
  const deadline = Date.now() + 20 * 60 * 1000;
  let status = operation;
  while (!status?.done && Date.now() < deadline) {
    await wait(10000);
    status = await jsonRequest(`${BASE}/${operation.name}`, apiKey, { method: "GET" }, 30000);
  }
  if (!status?.done) throw new Error("Veo excedeu o tempo limite de geração.");
  if (status?.error) throw new Error(`Veo falhou: ${status.error.message || "erro desconhecido"}`);
  const video = status?.response?.generateVideoResponse?.generatedSamples?.[0]?.video ||
    status?.response?.generatedVideos?.[0]?.video;
  const uri = video?.uri;
  if (!uri) throw new Error("Veo concluiu sem URI de vídeo.");
  const response = await fetch(uri, {
    headers: { "x-goog-api-key": apiKey },
    redirect: "follow",
    signal: AbortSignal.timeout(180000),
  });
  if (!response.ok) throw new Error(`Falha ao baixar vídeo Veo: HTTP ${response.status}`);
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType: video?.mimeType || "video/mp4",
    metadata: { operation_name: operation.name, model },
  };
}

module.exports = {
  generateText,
  reviewImages,
  generateImage,
  generateSpeech,
  generateVideo,
};
