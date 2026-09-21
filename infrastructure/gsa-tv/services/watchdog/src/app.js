"use strict";
const http = require("node:http");
const fs = require("node:fs/promises");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { Pool } = require("pg");
const execFileAsync = promisify(execFile);
const PORT = Number(process.env.PORT || 9204);
const DATABASE_URL = process.env.DATABASE_URL || "";
const CHANNEL_ID = process.env.CHANNEL_ID || "ch-main";
const CHANNEL_TIMEZONE = process.env.CHANNEL_TIMEZONE || "America/Sao_Paulo";
const N8N_WHATSAPP_WEBHOOK_URL = process.env.N8N_WHATSAPP_WEBHOOK_URL || "";
const CONTROL_PLANE_URL = String(
  process.env.CONTROL_PLANE_URL || "http://127.0.0.1:9202",
).replace(/\/$/, "");
const FFPLAYOUT_URL = String(
  process.env.FFPLAYOUT_URL || "http://127.0.0.1:8787",
).replace(/\/$/, "");
const FFPLAYOUT_CHANNEL_ID = Number(process.env.FFPLAYOUT_CHANNEL_ID || 1);
const FFPLAYOUT_PASSWORD_FILE =
  process.env.FFPLAYOUT_PASSWORD_FILE ||
  "/run/secrets/ffplayout-admin-password";
const HLS_URL =
  process.env.HLS_URL ||
  `${FFPLAYOUT_URL}/public/${FFPLAYOUT_CHANNEL_ID}/live/stream.m3u8`;
const PREVIEW_FILE = process.env.PREVIEW_FILE || "/preview/1/live/stream.m3u8";
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 2,
  application_name: "gsa-tv-watchdog",
});
let token = { access: "", expires: 0 };
let lastSample = null,
  lastQuality = null,
  lastCurrentKey = "",
  activeExecutionId = null,
  running = false;
function log(level, message, extra = {}) {
  process.stdout.write(
    JSON.stringify({
      time: new Date().toISOString(),
      level,
      message,
      ...extra,
    }) + "\n",
  );
}
async function fetchOk(url, timeout = 4000) {
  try {
    const r = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(timeout),
    });
    return { ok: r.ok, status: r.status, text: r.ok ? await r.text() : "" };
  } catch (e) {
    return { ok: false, status: 0, error: e.message, text: "" };
  }
}
async function login() {
  const password = (await fs.readFile(FFPLAYOUT_PASSWORD_FILE, "utf8")).trim();
  const r = await fetch(`${FFPLAYOUT_URL}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "admin", password }),
    signal: AbortSignal.timeout(5000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access) throw new Error(`ffplayout auth ${r.status}`);
  token = { access: j.access, expires: Date.now() + 35 * 60 * 1000 };
  return token.access;
}
async function ffApi(path) {
  const access =
    token.access && token.expires > Date.now() ? token.access : await login();
  let r = await fetch(`${FFPLAYOUT_URL}${path}`, {
    headers: { authorization: `Bearer ${access}` },
    signal: AbortSignal.timeout(5000),
  });
  if (r.status === 401) {
    const fresh = await login();
    r = await fetch(`${FFPLAYOUT_URL}${path}`, {
      headers: { authorization: `Bearer ${fresh}` },
      signal: AbortSignal.timeout(5000),
    });
  }
  if (!r.ok) throw new Error(`ffplayout ${path} ${r.status}`);
  return r.json();
}
const severityRank={info:0,warning:1,error:2,critical:3};
async function maybeDispatchAlert(incidentId,message,severity,details){
  const cfg=(await pool.query("select * from public.gsa_tv_alert_settings where channel_id=$1 and enabled limit 1",[CHANNEL_ID])).rows[0];if(!cfg)return;
  if((severityRank[severity]??0)<(severityRank[cfg.min_severity]??1))return;const number=String(cfg.whatsapp_number||'').replace(/\D/g,'');const hash=number?require('node:crypto').createHash('sha256').update(number).digest('hex').slice(0,24):null;
  const recent=await pool.query("select 1 from public.gsa_tv_alert_deliveries where channel_id=$1 and message=$2 and state='sent' and created_at>now()-make_interval(mins=>$3) limit 1",[CHANNEL_ID,message,cfg.cooldown_minutes]);if(recent.rowCount)return;
  if(!number||!N8N_WHATSAPP_WEBHOOK_URL){await pool.query("insert into public.gsa_tv_alert_deliveries(channel_id,incident_id,severity,destination_hash,state,message,error_message) values($1,$2,$3,$4,'suppressed',$5,$6)",[CHANNEL_ID,incidentId,severity,hash,message,!number?'Destino WhatsApp não configurado.':'Webhook n8n não configurado.']);return}
  const id=(await pool.query("insert into public.gsa_tv_alert_deliveries(channel_id,incident_id,severity,destination_hash,state,message) values($1,$2,$3,$4,'pending',$5) returning id",[CHANNEL_ID,incidentId,severity,hash,message])).rows[0].id;
  try{const r=await fetch(N8N_WHATSAPP_WEBHOOK_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({number,text:`GSA TV [${severity.toUpperCase()}]\n${message}\n${JSON.stringify(details||{}).slice(0,900)}`,delay:700,presence:'composing'}),signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error(`n8n HTTP ${r.status}`);await pool.query("update public.gsa_tv_alert_deliveries set state='sent',response_status=$2,sent_at=now() where id=$1",[id,r.status])}catch(e){await pool.query("update public.gsa_tv_alert_deliveries set state='failed',error_message=$2 where id=$1",[id,String(e.message||e).slice(0,500)])}
}
async function upsertIncident(message,severity,details,open){
  if(open){const e=await pool.query("select id from public.gsa_tv_incidents where channel_id=$1 and message=$2 and not resolved limit 1",[CHANNEL_ID,message]);if(!e.rowCount){const created=await pool.query("insert into public.gsa_tv_incidents(channel_id,severity,message,details) values($1,$2,$3,$4) returning id",[CHANNEL_ID,severity,message,details]);await maybeDispatchAlert(created.rows[0].id,message,severity,details)}else await pool.query("update public.gsa_tv_incidents set details=$2 where id=$1",[e.rows[0].id,details]);}
  else await pool.query("update public.gsa_tv_incidents set resolved=true,resolved_at=now() where channel_id=$1 and message=$2 and not resolved",[CHANNEL_ID,message]);
}
async function currentMedia() {
  try {
    return await ffApi(`/api/control/${FFPLAYOUT_CHANNEL_ID}/media/current`);
  } catch (e) {
    return { error: e.message };
  }
}
async function hlsState() {
  const net = await fetchOk(HLS_URL, 4000);
  let age = null;
  try {
    const st = await fs.stat(PREVIEW_FILE);
    age = (Date.now() - st.mtimeMs) / 1000;
  } catch {}
  return {
    ok: net.ok && net.text.includes("#EXTM3U"),
    status: net.status,
    age_s: age,
    playlist: net.text,
  };
}
async function qualityProbe() {
  try {
    const { stderr } = await execFileAsync(
      "ffmpeg",
      [
        "-hide_banner",
        "-nostdin",
        "-loglevel",
        "info",
        "-t",
        "8",
        "-i",
        HLS_URL,
        "-vf",
        "blackdetect=d=2:pix_th=0.10,freezedetect=n=-60dB:d=3",
        "-af",
        "silencedetect=n=-50dB:d=3",
        "-f",
        "null",
        "-",
      ],
      { timeout: 25000, maxBuffer: 1024 * 1024 },
    );
    const s = String(stderr || "");
    return {
      ok: true,
      black: /black_start:/i.test(s),
      silence: /silence_start:/i.test(s),
      freeze: /freeze_start:/i.test(s),
    };
  } catch (e) {
    const s = String(e.stderr || "");
    return {
      ok: false,
      black: /black_start:/i.test(s),
      silence: /silence_start:/i.test(s),
      freeze: /freeze_start:/i.test(s),
      error: e.message,
    };
  }
}
async function activePublishedBlock(){
  const r=await pool.query(`select v.id as schedule_version_id,b.id as program_block_id,b.campaign_id,b.episode_id,b.is_reprise,b.live_source_id from public.gsa_tv_schedule_versions v join public.gsa_tv_program_blocks b on b.schedule_version_id=v.id where v.channel_id=$1 and v.state='published' and v.broadcast_date=(now() at time zone $2)::date and b.planned_start_offset_s<=extract(epoch from (now() at time zone $2)::time)::int and b.planned_start_offset_s+b.planned_duration_s>extract(epoch from (now() at time zone $2)::time)::int order by b.position limit 1`,[CHANNEL_ID,CHANNEL_TIMEZONE]);return r.rows[0]||null;
}
async function syncExecution(current){
  if(current?.error||!current?.media)return;const source=String(current.media.source||'');const title=String(current.media.title||'Sem título');const key=`${source}|${title}|${current.mode||""}`;if(key===lastCurrentKey)return;
  if(activeExecutionId){await pool.query("update public.gsa_tv_execution_log set ended_at=now(),duration_s=extract(epoch from now()-started_at),outcome=case when outcome='in_progress' then 'completed' else outcome end where id=$1",[activeExecutionId]);activeExecutionId=null}
  let mediaId=null,slotId=null;const m=await pool.query("select id from public.gsa_tv_media_items where drive_path=$1 limit 1",[source]);if(m.rowCount)mediaId=m.rows[0].id;const legacy=await pool.query("select id from public.gsa_tv_schedule_slots where channel_id=$1 and scheduled_start<=now() and scheduled_end>now() and state='confirmed' order by scheduled_start desc limit 1",[CHANNEL_ID]);if(legacy.rowCount)slotId=legacy.rows[0].id;const block=await activePublishedBlock();
  const outcome=/filler|continuidade/i.test(`${source} ${title}`)?'fallback':current.ingest?'live':'in_progress';const r=await pool.query(`insert into public.gsa_tv_execution_log(channel_id,media_item_id,schedule_slot_id,schedule_version_id,program_block_id,campaign_id,episode_id,is_reprise,live_source_id,title,source,outcome,metrics) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,[CHANNEL_ID,mediaId,slotId,block?.schedule_version_id||null,block?.program_block_id||null,block?.campaign_id||null,block?.episode_id||null,Boolean(block?.is_reprise),block?.live_source_id||null,title,source,outcome,{mode:current.mode,index:current.index,ingest:Boolean(current.ingest)}]);activeExecutionId=r.rows[0].id;lastCurrentKey=key;log('info','as_run_changed',{title,outcome,block_id:block?.program_block_id||null,campaign_id:block?.campaign_id||null});
}
async function cycle() {
  if (running) return;
  running = true;
  try {
    const cp = await fetchOk(`${CONTROL_PLANE_URL}/health`);
    const ff = await fetchOk(`${FFPLAYOUT_URL}/`);
    const hls = await hlsState();
    const ch =
      (
        await pool.query(
          "select desired_state,signal_state,last_signal_at,playout_state from public.gsa_tv_channels where id=$1",
          [CHANNEL_ID],
        )
      ).rows[0] || {};
    let current = await currentMedia();
    if(String(ch.playout_state||'').includes('live:')){const sourceId=String(ch.playout_state).split(':').pop();const live=(await pool.query("select name from public.gsa_tv_live_sources where id=$1",[sourceId])).rows[0];current={media:{title:live?.name||'Entrada ao vivo',source:`live:${sourceId}`},ingest:true,mode:'live'};}
    await syncExecution(current);
    let allowStaticVideo = false;
    const currentSource = String(current?.media?.source || '');
    if (currentSource.startsWith('/media/')) {
      const mediaPolicy = await pool.query("select coalesce((metadata->>'allow_static_video')::boolean,false) as allow_static from public.gsa_tv_media_items where drive_path=$1 limit 1", [currentSource]);
      allowStaticVideo = Boolean(mediaPolicy.rows[0]?.allow_static);
    }
    const expected =
      ch.desired_state === "running" || ch.desired_state === "paused";
    const contentExpected =
      ch.desired_state === "running" &&
      current?.media &&
      !/filler|continuidade/i.test(
        `${current.media.source || ""} ${current.media.title || ""}`,
      );
    if (!expected) {
      lastQuality = {
        at: Date.now(),
        ok: true,
        black: false,
        silence: false,
        freeze: false,
        standby: true,
      };
    } else if (!lastQuality || Date.now() - lastQuality.at > 60000) {
      lastQuality = { at: Date.now(), ...(await qualityProbe()) };
    }
    const freezeBad = Boolean(contentExpected && !allowStaticVideo && lastQuality.freeze);
    const signalAge = ch.last_signal_at
      ? (Date.now() - new Date(ch.last_signal_at).getTime()) / 1000
      : null;
    const hlsBad =
      expected && (!hls.ok || (hls.age_s != null && hls.age_s > 20));
    const signalBad =
      expected &&
      (ch.signal_state !== "sending" || (signalAge != null && signalAge > 90));
    await upsertIncident(
      "Watchdog: Control Plane indisponível",
      "critical",
      { component: "control-plane" },
      !cp.ok,
    );
    await upsertIncident(
      "Watchdog: ffplayout indisponível",
      "critical",
      { component: "ffplayout" },
      !ff.ok,
    );
    await upsertIncident(
      "Watchdog: HLS ausente ou congelado",
      "critical",
      { hls_age_s: hls.age_s, status: hls.status },
      hlsBad,
    );
    await upsertIncident(
      "Watchdog: sinal esperado não confirmado",
      "critical",
      { signal_state: ch.signal_state, signal_age_s: signalAge },
      signalBad,
    );
    await upsertIncident(
      "Watchdog: tela preta detectada",
      "error",
      { title: current?.media?.title },
      Boolean(contentExpected && lastQuality.black),
    );
    await upsertIncident(
      "Watchdog: silêncio prolongado detectado",
      "warning",
      { title: current?.media?.title },
      Boolean(contentExpected && lastQuality.silence),
    );
    await upsertIncident(
      "Watchdog: vídeo congelado detectado",
      "error",
      { title: current?.media?.title },
      freezeBad,
    );
    const metrics = {
      audio: current?.audio || null,
      elapsed: current?.elapsed || null,
      index: current?.index || null,
      quality_probe_ok: lastQuality.ok,
      signal_age_s: signalAge,
      freeze_exempt: allowStaticVideo,
    };
    await pool.query(
      "insert into public.gsa_tv_watchdog_samples(channel_id,control_plane_ok,ffplayout_ok,hls_ok,hls_age_s,signal_expected,signal_state,current_title,black_detected,silence_detected,freeze_detected,metrics) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
      [
        CHANNEL_ID,
        cp.ok,
        ff.ok,
        hls.ok,
        hls.age_s,
        expected,
        ch.signal_state || "unknown",
        current?.media?.title || null,
        Boolean(contentExpected && lastQuality.black),
        Boolean(contentExpected && lastQuality.silence),
        freezeBad,
        metrics,
      ],
    );
    lastSample = {
      at: new Date().toISOString(),
      control_plane_ok: cp.ok,
      ffplayout_ok: ff.ok,
      hls_ok: hls.ok,
      hls_age_s: hls.age_s,
      signal_expected: expected,
      signal_state: ch.signal_state || "unknown",
      current_title: current?.media?.title || null,
      quality: {
        ...lastQuality,
        black: Boolean(contentExpected && lastQuality.black),
        silence: Boolean(contentExpected && lastQuality.silence),
        freeze: freezeBad,
      },
    };
    if (Math.random() < 0.02)
      await pool.query(
        "delete from public.gsa_tv_watchdog_samples where created_at<now()-interval '30 days'",
      );
  } catch (e) {
    log("error", "watchdog_cycle_failed", { error: e.message });
  } finally {
    running = false;
  }
}
function metrics() {
  const s = lastSample || {};
  const q = s.quality || {};
  return (
    [
      `gsa_tv_watchdog_up 1`,
      `gsa_tv_control_plane_ok ${s.control_plane_ok ? 1 : 0}`,
      `gsa_tv_ffplayout_ok ${s.ffplayout_ok ? 1 : 0}`,
      `gsa_tv_hls_ok ${s.hls_ok ? 1 : 0}`,
      `gsa_tv_hls_age_seconds ${Number.isFinite(s.hls_age_s) ? s.hls_age_s : 0}`,
      `gsa_tv_signal_expected ${s.signal_expected ? 1 : 0}`,
      `gsa_tv_black_detected ${q.black ? 1 : 0}`,
      `gsa_tv_silence_detected ${q.silence ? 1 : 0}`,
      `gsa_tv_freeze_detected ${q.freeze ? 1 : 0}`,
    ].join("\n") + "\n"
  );
}
const server = http.createServer(async (req, res) => {
  if (req.url === "/health") {
    try {
      await pool.query("select 1");
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(
        JSON.stringify({
          status: "ok",
          service: "gsa-tv-watchdog",
          last_sample: lastSample?.at || null,
        }),
      );
    } catch (e) {
      res.writeHead(503);
      return res.end();
    }
  }
  if (req.url === "/metrics") {
    res.writeHead(200, { "content-type": "text/plain; version=0.0.4" });
    return res.end(metrics());
  }
  res.writeHead(404);
  res.end();
});
server.listen(PORT, "127.0.0.1", () =>
  log("info", "watchdog_started", { port: PORT }),
);
setInterval(() => cycle(), 15000);
void cycle();
process.on("SIGTERM", async () => {
  if (activeExecutionId)
    await pool
      .query(
        "update public.gsa_tv_execution_log set ended_at=now(),duration_s=extract(epoch from now()-started_at),outcome=case when outcome='in_progress' then 'interrupted' else outcome end where id=$1",
        [activeExecutionId],
      )
      .catch(() => {});
  server.close();
  await pool.end();
});
