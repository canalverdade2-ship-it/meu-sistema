#!/usr/bin/env bash
docker exec -i gsa-tv-control-plane node -e '
const crypto = require("crypto");
const {Pool} = require("pg");
const gemini = require("/app/src/gemini.js");
(async () => {
  const p = new Pool({connectionString: process.env.DATABASE_URL});
  const row = (await p.query("select * from gsa_tv_ai_provider_secrets where channel_id=\x27ch-main\x27 order by updated_at desc limit 1")).rows[0];
  const [version, ivPart, bodyPart] = row.api_key_ciphertext.split(".");
  const encrypted = Buffer.from(bodyPart, "base64url");
  const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(process.env.GSA_TV_SECRET_KEY, "hex"), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(encrypted.subarray(-16));
  const apiKey = Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()]).toString("utf8");
  
  console.log("Testing gemini.generateText with gemini-3-flash-preview...");
  const res = await gemini.generateText({
    apiKey,
    model: "gemini-3-flash-preview",
    prompt: "Escreva um roteiro curto de teste com 50 palavras sobre tecnologia. Responda em JSON com title e text.",
    instructions: "Responda apenas JSON.",
    maxOutputTokens: 2000
  });
  console.log("RESULT:", res.text);
  console.log("USAGE:", res.usage);
  await p.end();
})().catch(console.error);
'
