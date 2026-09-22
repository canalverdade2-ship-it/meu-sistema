#!/usr/bin/env python3
"""GSA TV Autopilot V2 — final D+1 continuity fallback.

Last-resort, deterministic safety net. It runs only late in D0, after the normal
content factory had the day to solve missing/short media. Eligible unresolved
original-program blocks for D+1 are atomically switched to the official
institutional continuity media. The playlist compiler already loops/pads
library-mode media to the exact slot length.

No current-day block is mutated.
"""
import argparse
import datetime as dt
import fcntl
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import sys
from zoneinfo import ZoneInfo

TZ = ZoneInfo("America/Sao_Paulo")
ROOT = Path(os.environ.get("GSA_TV_ROOT", "/opt/gsa-tv"))
MEDIA = ROOT / "cache" / "media" / "1"
BIN = ROOT / "bin"
STATE_DIR = ROOT / "runtime" / "autopilot"
READINESS_FILE = STATE_DIR / "readiness-horizon.json"
STATE_FILE = STATE_DIR / "fallback-engine.json"
PRODUCTION_LOCK = "/tmp/gsa-tv-night-factory.lock"
FALLBACK_MEDIA_ID = "media-autopilot-official-continuity"

ACTIONABLE = {
    "missing_media",
    "content_shortfall",
    "media_not_ready",
    "media_not_approved",
    "rights_not_confirmed",
    "rights_expire_before_block_end",
}

PG = r"""const{Pool}=require('pg');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',async()=>{const p=new Pool({connectionString:process.env.DATABASE_URL});try{const q=JSON.parse(s);const r=await p.query(q.sql,q.params);console.log(JSON.stringify(r.rows||[]))}catch(e){console.error(e.message);process.exitCode=1}finally{await p.end()}});"""


def now():
    return dt.datetime.now(TZ)


def atomic_write(payload):
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    tmp.replace(STATE_FILE)


def query(sql, params=None):
    result = subprocess.run(
        ["docker", "exec", "-i", "gsa-tv-control-plane", "node", "-e", PG],
        input=json.dumps({"sql": sql, "params": params or []}),
        text=True,
        capture_output=True,
        timeout=30,
    )
    if result.returncode != 0:
        raise RuntimeError((result.stderr or result.stdout or "database query failed").strip())
    return json.loads(result.stdout or "[]")


def refresh_readiness():
    subprocess.run(
        [sys.executable, str(BIN / "autopilot-readiness.py"), "--days", "4"],
        stdout=subprocess.DEVNULL,
        check=True,
        timeout=180,
    )


def load_readiness():
    if not READINESS_FILE.is_file():
        raise RuntimeError("readiness snapshot missing")
    return json.loads(READINESS_FILE.read_text())


def parse_clock(value):
    parts = [int(x) for x in str(value or "06:00:00").split(":")]
    while len(parts) < 3:
        parts.append(0)
    return dt.time(parts[0], parts[1], parts[2])


def activation_window(default_hours):
    current = now()
    tomorrow = current.date() + dt.timedelta(days=1)
    rows = query(
        "select config->'broadcast_schedule_policy' policy from public.gsa_tv_channels where id='ch-main'"
    )
    policy = (rows[0].get("policy") if rows else None) or {}
    on_air = parse_clock(policy.get("on_air_start", "06:00:00"))
    next_start = dt.datetime.combine(tomorrow, on_air, TZ)

    configured = os.environ.get("GSA_TV_AUTOPILOT_FALLBACK_HOURS")
    try:
        hours = float(configured) if configured else float(default_hours)
    except ValueError:
        hours = float(default_hours)
    hours = min(18.0, max(1.0, hours))

    by_airtime = next_start - dt.timedelta(hours=hours)
    latest_before_midnight = dt.datetime.combine(
        current.date(), dt.time(23, 0), TZ
    )
    activate_at = min(by_airtime, latest_before_midnight)
    return {
        "tomorrow": tomorrow,
        "next_start": next_start,
        "activate_at": activate_at,
        "hours_before_on_air": hours,
        "active": current >= activate_at,
    }


def probe(path):
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)],
        capture_output=True,
        text=True,
        check=True,
        timeout=30,
    )
    data = json.loads(result.stdout)
    duration = float(data["format"]["duration"])
    video = next((x for x in data.get("streams", []) if x.get("codec_type") == "video"), None)
    audio = next((x for x in data.get("streams", []) if x.get("codec_type") == "audio"), None)
    if not math.isfinite(duration) or duration <= 0 or not video or not audio:
        raise ValueError("official continuity file must contain valid video and audio")
    fps_raw = str(video.get("avg_frame_rate") or video.get("r_frame_rate") or "30/1")
    try:
        a, b = fps_raw.split("/", 1)
        fps = float(a) / float(b)
    except Exception:
        fps = 30.0
    return {
        "duration_s": duration,
        "video_codec": video.get("codec_name") or "h264",
        "width": int(video.get("width") or 1920),
        "height": int(video.get("height") or 1080),
        "fps": fps,
        "audio_codec": audio.get("codec_name") or "aac",
        "sample_rate": int(audio.get("sample_rate") or 48000),
        "channels": int(audio.get("channels") or 2),
    }


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def ensure_official_continuity():
    candidates = [
        MEDIA / "identity" / "gsa-tv-fallback-720p30.mp4",
        ROOT / "fallback" / "gsa-tv-fallback-720p30.mp4",
    ]
    source = next((p for p in candidates if p.is_file() and p.stat().st_size > 0), None)
    if not source:
        raise FileNotFoundError("official continuity media not found")
    tech = probe(source)

    media_root = MEDIA.resolve()
    source_resolved = source.resolve()
    if source_resolved.is_relative_to(media_root):
        drive_path = "/media/1/" + str(source_resolved.relative_to(media_root))
    else:
        # The DB media path must be visible inside the Control Plane. Copy the
        # protected fallback into the channel media tree if only /fallback exists.
        target = MEDIA / "identity" / "gsa-tv-fallback-720p30.mp4"
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            subprocess.run(["cp", "--reflink=auto", str(source_resolved), str(target)], check=True)
        source = target
        tech = probe(source)
        drive_path = "/media/1/identity/gsa-tv-fallback-720p30.mp4"

    source_sha256 = sha256_file(source)
    existing = query(
        """select id,drive_path,metadata
             from public.gsa_tv_media_items
            where id=$1 and channel_id='ch-main'
            limit 1""",
        [FALLBACK_MEDIA_ID],
    )
    if existing:
        previous_sha = str((existing[0].get("metadata") or {}).get("sha256") or "")
        if previous_sha and previous_sha != source_sha256:
            raise RuntimeError("official continuity checksum changed; manual review required")

    metadata = {
        "autopilot_official_continuity": True,
        "source": "official_gsa_tv_continuity",
        "purpose": "last_resort_schedule_fallback",
        "sha256": source_sha256,
    }
    query(
        """insert into public.gsa_tv_media_items(
             id,channel_id,title,original_filename,duration_s,
             video_codec,video_width,video_height,video_fps,
             audio_codec,audio_sample_rate,audio_channels,
             state,rights_ok,drive_path,media_kind,source_type,
             ai_generated,approval_state,metadata
           ) values(
             $1,'ch-main',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
             'ready',true,$12,'program','services',false,'approved',$13::jsonb
           )
           on conflict(id) do update set
             title=excluded.title,
             original_filename=excluded.original_filename,
             duration_s=excluded.duration_s,
             video_codec=excluded.video_codec,
             video_width=excluded.video_width,
             video_height=excluded.video_height,
             video_fps=excluded.video_fps,
             audio_codec=excluded.audio_codec,
             audio_sample_rate=excluded.audio_sample_rate,
             audio_channels=excluded.audio_channels,
             state='ready',rights_ok=true,drive_path=excluded.drive_path,
             approval_state='approved',metadata=excluded.metadata,updated_at=now()""",
        [
            FALLBACK_MEDIA_ID,
            "Continuidade Institucional GSA TV — Autopilot",
            source.name,
            round(tech["duration_s"], 3),
            tech["video_codec"],
            tech["width"],
            tech["height"],
            tech["fps"],
            tech["audio_codec"],
            tech["sample_rate"],
            tech["channels"],
            drive_path,
            json.dumps(metadata),
        ],
    )
    return {
        "media_id": FALLBACK_MEDIA_ID,
        "drive_path": drive_path,
        "duration_s": tech["duration_s"],
        "sha256": source_sha256,
    }


def block_details(block_id, date):
    rows = query(
        """select b.id,b.media_item_id,b.program_id,b.block_type,b.is_reprise,
                  b.metadata,b.planned_start_offset_s,b.planned_duration_s,
                  v.state schedule_state,v.broadcast_date
             from public.gsa_tv_program_blocks b
             join public.gsa_tv_schedule_versions v on v.id=b.schedule_version_id
            where b.id=$1::uuid and v.broadcast_date=$2::date
            limit 1""",
        [block_id, date],
    )
    return rows[0] if rows else None


def eligible_block(block):
    return bool(
        block
        and block.get("schedule_state") == "published"
        and block.get("block_type") != "live"
        and not block.get("is_reprise")
        and (block.get("metadata") or {}).get("content_mode") != "library"
    )


def assign(block, date, fallback_media_id):
    rows = query(
        """select public.gsa_tv_autopilot_assign_continuity_fallback(
               $1::uuid,$2::text,$3::text,$4::date
             ) result""",
        [
            block["id"],
            block.get("media_item_id"),
            fallback_media_id,
            date,
        ],
    )
    return rows[0]["result"] if rows else None


def compile_if_ready(date):
    result = subprocess.run(
        [sys.executable, str(BIN / "night-production.py"), "--compile-ready", "--date", date],
        capture_output=True,
        text=True,
        timeout=240,
    )
    return {
        "returncode": result.returncode,
        "stdout_tail": (result.stdout or "")[-1200:],
        "stderr_tail": (result.stderr or "")[-1200:],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--fallback-hours", type=float, default=7.0)
    parser.add_argument("--max-blocks", type=int, default=100)
    args = parser.parse_args()
    if not 1 <= args.max_blocks <= 500:
        raise SystemExit("--max-blocks must be between 1 and 500")

    STATE_DIR.mkdir(parents=True, exist_ok=True)
    lock = open(PRODUCTION_LOCK, "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        atomic_write({
            "state": "skipped",
            "reason": "production_lock_busy",
            "checked_at": now().isoformat(),
        })
        return 0

    window = activation_window(args.fallback_hours)
    state = {
        "state": "checking",
        "checked_at": now().isoformat(),
        "broadcast_date": window["tomorrow"].isoformat(),
        "activate_at": window["activate_at"].isoformat(),
        "next_on_air": window["next_start"].isoformat(),
        "hours_before_on_air": window["hours_before_on_air"],
    }

    if not window["active"]:
        state.update(state="idle", reason="fallback_window_not_open")
        atomic_write(state)
        return 0

    refresh_readiness()
    report = load_readiness()
    day = next(
        (x for x in report.get("days_detail", []) if x.get("date") == window["tomorrow"].isoformat()),
        None,
    )
    if not day or day.get("schedule_state") != "published":
        state.update(state="blocked", reason="d1_schedule_not_published")
        atomic_write(state)
        return 2

    issues = [
        x for x in (day.get("issues") or [])
        if x.get("block_id") and x.get("issue") in ACTIONABLE
    ]
    if not issues:
        state.update(state="idle", reason="d1_no_actionable_media_issues", assigned=0)
        atomic_write(state)
        return 0

    fallback = ensure_official_continuity()
    state["fallback_media"] = fallback
    state["issues_before"] = len(issues)
    state["assignments"] = []
    atomic_write(state)

    for issue in issues[: args.max_blocks]:
        block = block_details(issue["block_id"], window["tomorrow"].isoformat())
        if not eligible_block(block):
            state["assignments"].append({
                "block_id": issue["block_id"],
                "issue": issue["issue"],
                "state": "skipped_not_eligible",
            })
            continue
        try:
            result = assign(block, window["tomorrow"].isoformat(), fallback["media_id"])
            state["assignments"].append({
                "block_id": issue["block_id"],
                "issue": issue["issue"],
                "state": "assigned",
                "result": result,
            })
        except Exception as exc:
            state["assignments"].append({
                "block_id": issue["block_id"],
                "issue": issue["issue"],
                "state": "failed",
                "error": str(exc)[:600],
            })
        atomic_write(state)

    refresh_readiness()
    after = load_readiness()
    d1_after = next(
        (x for x in after.get("days_detail", []) if x.get("date") == window["tomorrow"].isoformat()),
        None,
    )
    state["d1_after"] = d1_after
    state["assigned"] = sum(1 for x in state["assignments"] if x["state"] == "assigned")
    state["failed"] = sum(1 for x in state["assignments"] if x["state"] == "failed")

    if d1_after and d1_after.get("state") == "ready":
        state["compile"] = compile_if_ready(window["tomorrow"].isoformat())
        state["state"] = "fallback_ready"
    else:
        state["state"] = "fallback_incomplete"

    state["finished_at"] = now().isoformat()
    atomic_write(state)
    return 0 if state["failed"] == 0 else 2


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        atomic_write({
            "state": "failed",
            "error": str(exc)[:1000],
            "finished_at": now().isoformat(),
        })
        raise
