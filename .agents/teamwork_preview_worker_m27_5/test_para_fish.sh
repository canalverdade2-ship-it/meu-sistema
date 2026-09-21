#!/usr/bin/env bash
docker exec -i gsa-tv-control-plane node -e '
const fs = require("fs/promises");
const crypto = require("crypto");

(async () => {
  const vaultPath = "/media/1/production/autonomous/fish-production.enc.json";
  const v = JSON.parse(await fs.readFile(vaultPath, "utf8"));
  const k = Buffer.from(process.env.GSA_TV_SECRET_KEY, "hex");
  const n = Buffer.from(v.nonce, "base64url");
  const a = Buffer.from(v.ciphertext, "base64url");
  const d = crypto.createDecipheriv("aes-256-gcm", k, n);
  d.setAAD(Buffer.from(v.aad));
  d.setAuthTag(a.subarray(-16));
  const dec = JSON.parse(Buffer.concat([d.update(a.subarray(0, -16)), d.final()]).toString("utf8"));
  const fishApiKey = dec.api_key;

  const text = "Olá e bem-vindos ao GSA Bem Viver! É um prazer ter você conosco para mais um programa dedicado à sua qualidade de vida. Hoje, vamos explorar um tema fundamental para o nosso bem-estar: o equilíbrio.";
  console.log("Synthesizing paragraph with Fish Audio (", text.length, "chars)...");
  const t0 = Date.now();
  const resp = await fetch("https://api.fish.audio/v1/tts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${fishApiKey}`,
      "Content-Type": "application/json",
      model: "s2.1-pro-free",
    },
    body: JSON.stringify({
      text,
      reference_id: "5c8a9b5d0b2549c7ada853529199ebe5",
      format: "mp3",
      normalize: true,
      latency: "normal",
      prosody: { speed: 1.0, volume: 0, normalize_loudness: true },
    }),
  });
  console.log("Status:", resp.status, "Time:", Date.now() - t0, "ms");
  if (resp.ok) {
    const buf = Buffer.from(await resp.arrayBuffer());
    console.log("Bytes:", buf.length);
  }
})().catch(console.error);
'
