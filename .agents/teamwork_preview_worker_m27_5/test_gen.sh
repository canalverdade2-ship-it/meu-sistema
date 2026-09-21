#!/usr/bin/env bash
docker exec -i gsa-tv-control-plane node -e '
const crypto = require("crypto");
const {Pool} = require("pg");
(async () => {
  const p = new Pool({connectionString: process.env.DATABASE_URL});
  const row = (await p.query("select * from gsa_tv_ai_provider_secrets where channel_id=\x27ch-main\x27 order by updated_at desc limit 1")).rows[0];
  const [version, ivPart, bodyPart] = row.api_key_ciphertext.split(".");
  const encrypted = Buffer.from(bodyPart, "base64url");
  const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(process.env.GSA_TV_SECRET_KEY, "hex"), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(encrypted.subarray(-16));
  const apiKey = Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()]).toString("utf8");
  
  const testModels = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-3-flash-preview", "gemini-flash-latest"];
  for (const m of testModels) {
    try {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + m + ":generateContent", {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: "Diga apenas: OK " + m }] }] })
      });
      const data = await res.json();
      if (res.ok) {
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log("SUCCESS:", m, "->", text?.trim());
      } else {
        console.log("FAIL:", m, "status:", res.status, "msg:", data.error?.message?.slice(0, 100));
      }
    } catch (e) {
      console.log("ERR:", m, e.message);
    }
  }
  await p.end();
})().catch(console.error);
'
