#!/usr/bin/env python3
"""GSA TV Autopilot V2 — duration shortfall engine.

Repairs one future underfilled original-program block per cycle. It generates or
reuses a full-slot autonomous master and performs an atomic compare-and-swap via
public.gsa_tv_autopilot_replace_shortfall_media().

The engine never touches current-day blocks, live blocks, reprises, or library
content. It shares the night-production lock so it cannot render concurrently
with the continuous content factory.
"""
import argparse
import datetime as dt
import fcntl
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import unicodedata
from zoneinfo import ZoneInfo

TZ = ZoneInfo("America/Sao_Paulo")
ROOT = Path(os.environ.get("GSA_TV_ROOT", "/opt/gsa-tv"))
MEDIA = ROOT / "cache" / "media" / "1"
BIN = ROOT / "bin"
STATE_DIR = ROOT / "runtime" / "autopilot"
READINESS_FILE = STATE_DIR / "readiness-horizon.json"
STATE_FILE = STATE_DIR / "duration-engine.json"
PRODUCTION_LOCK = "/tmp/gsa-tv-night-factory.lock"

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


def slug(value):
    value = "".join(
        c for c in unicodedata.normalize("NFD", value or "")
        if not unicodedata.combining(c)
    ).lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def probe_duration(path):
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True,
        text=True,
        timeout=30,
        check=True,
    )
    value = float(result.stdout.strip())
    if value <= 0:
        raise ValueError("invalid media duration")
    return value


def refresh_readiness(days):
    subprocess.run(
        [sys.executable, str(BIN / "autopilot-readiness.py"), "--days", str(days)],
        stdout=subprocess.DEVNULL,
        check=True,
        timeout=180,
    )


def load_readiness():
    if not READINESS_FILE.is_file():
        raise RuntimeError("readiness snapshot missing")
    return json.loads(READINESS_FILE.read_text())


def select_shortfall(report, horizon_days):
    today = now().date()
    candidates = []
    for day in report.get("days_detail", []):
        try:
            date = dt.date.fromisoformat(day["date"])
        except Exception:
            continue
        delta = (date - today).days
        if delta < 1 or delta > horizon_days:
            continue
        if day.get("schedule_state") != "published":
            continue
        for issue in day.get("issues") or []:
            if issue.get("issue") != "content_shortfall":
                continue
            candidates.append((
                delta,
                int(issue.get("planned_start_offset_s") or 0),
                date,
                issue,
            ))
    if not candidates:
        return None
    candidates.sort(key=lambda item: (item[0], item[1]))
    _, _, date, issue = candidates[0]
    return {"date": date.isoformat(), **issue}


def block_details(block_id, date):
    rows = query(
        """select
               b.id,
               b.program_id,
               p.name as program_name,
               b.media_item_id,
               b.block_type,
               b.is_reprise,
               b.metadata,
               b.planned_start_offset_s,
               b.planned_duration_s,
               v.id as schedule_version_id,
               v.channel_id,
               v.broadcast_date,
               v.state as schedule_state,
               m.duration_s as current_media_duration_s
           from public.gsa_tv_program_blocks b
           join public.gsa_tv_schedule_versions v on v.id=b.schedule_version_id
           left join public.gsa_tv_programs p on p.id=b.program_id
           left join public.gsa_tv_media_items m on m.id=b.media_item_id
          where b.id=$1::uuid and v.broadcast_date=$2::date
          limit 1""",
        [block_id, date],
    )
    return rows[0] if rows else None


def validate_block(block):
    if not block:
        return False, "block_not_found"
    if block.get("channel_id") != "ch-main" or block.get("schedule_state") != "published":
        return False, "schedule_not_published"
    if not block.get("media_item_id"):
        return False, "media_link_missing"
    if not block.get("program_id") or not block.get("program_name"):
        return False, "program_identity_missing"
    if block.get("block_type") == "live":
        return False, "live_block"
    if block.get("is_reprise"):
        return False, "reprise_block"
    if (block.get("metadata") or {}).get("content_mode") == "library":
        return False, "library_block"
    planned = float(block.get("planned_duration_s") or 0)
    current = float(block.get("current_media_duration_s") or 0)
    if current + 1 >= planned:
        return False, "shortfall_already_resolved"
    return True, None


def existing_candidate(block, date):
    rows = query(
        """select id,duration_s,drive_path,updated_at
             from public.gsa_tv_media_items
            where channel_id='ch-main'
              and state='ready'
              and approval_state='approved'
              and rights_ok
              and metadata->>'broadcast_date'=$1
              and metadata->>'target_block_id'=$2
              and metadata->>'production_reason'='duration_shortfall'
            order by updated_at desc
            limit 1""",
        [date, str(block["id"])],
    )
    return rows[0] if rows else None


def target_words(block):
    planned = float(block["planned_duration_s"])
    program_slug = slug(block["program_name"])
    specific = MEDIA / "identity" / "vinhetas" / f"vinheta-{program_slug}.mp4"
    fallback = MEDIA / "identity" / "vinhetas" / "vinheta-gsa-tv-40s-broadcast-safe.mp4"
    chosen = specific if specific.is_file() else fallback
    try:
        reserve = 2 * probe_duration(chosen)
    except Exception:
        reserve = 80.0
    try:
        wpm = float(os.environ.get("GSA_TV_AUTOPILOT_SPEECH_WPM", "125"))
    except ValueError:
        wpm = 125.0
    wpm = min(170.0, max(90.0, wpm))
    speech_seconds = max(60.0, planned - reserve)
    return min(10000, max(500, int(round((speech_seconds / 60.0) * wpm))))


def terminate_group(child):
    try:
        os.killpg(child.pid, signal.SIGTERM)
        child.wait(timeout=30)
    except Exception:
        try:
            os.killpg(child.pid, signal.SIGKILL)
        except Exception:
            pass


def generate_candidate(block, date, timeout_minutes):
    program_slug = slug(block["program_name"])
    output = f"/media/1/production/autonomous/{date}/{program_slug}-duration-{block['id']}.json"
    task = {
        "output": output,
        "mode": "generic_program",
        "targetWords": target_words(block),
        "targetSeconds": float(block["planned_duration_s"]),
        "date": date,
        "program": block["program_name"],
        "programId": str(block["program_id"]),
        "targetBlockId": str(block["id"]),
        "productionReason": "duration_shortfall",
    }

    child = subprocess.Popen(
        ["docker", "exec", "-i", "gsa-tv-control-plane", "node",
         "/media/1/production/autonomous/tools/autonomous-script.cjs"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        start_new_session=True,
    )
    try:
        stdout, _ = child.communicate(
            input=json.dumps(task),
            timeout=timeout_minutes * 60,
        )
    except subprocess.TimeoutExpired:
        terminate_group(child)
        raise TimeoutError("duration candidate generation timed out")

    if child.returncode != 0:
        raise RuntimeError("autonomous generation failed: " + (stdout or "")[-800:])

    for line in reversed([x.strip() for x in (stdout or "").splitlines() if x.strip()]):
        try:
            result = json.loads(line)
        except Exception:
            continue
        if isinstance(result, dict) and result.get("media_id"):
            return result
    raise RuntimeError("autonomous generation returned no media_id")


def replace(block, media_id, date):
    rows = query(
        """select public.gsa_tv_autopilot_replace_shortfall_media(
               $1::uuid,$2::text,$3::text,$4::date
             ) as result""",
        [str(block["id"]), block["media_item_id"], media_id, date],
    )
    if not rows:
        raise RuntimeError("duration swap returned no result")
    return rows[0]["result"]


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
    parser.add_argument("--horizon-days", type=int, default=3)
    parser.add_argument("--timeout-minutes", type=int, default=50)
    args = parser.parse_args()
    if not 1 <= args.horizon_days <= 7:
        raise SystemExit("--horizon-days must be between 1 and 7")
    if not 10 <= args.timeout_minutes <= 120:
        raise SystemExit("--timeout-minutes must be between 10 and 120")

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

    refresh_readiness(max(4, args.horizon_days + 1))
    report = load_readiness()
    target = select_shortfall(report, args.horizon_days)
    if not target:
        atomic_write({
            "state": "idle",
            "reason": "no_duration_shortfall",
            "checked_at": now().isoformat(),
        })
        return 0

    block = block_details(target["block_id"], target["date"])
    eligible, reason = validate_block(block)
    if not eligible:
        atomic_write({
            "state": "skipped",
            "reason": reason,
            "target": target,
            "checked_at": now().isoformat(),
        })
        return 0

    state = {
        "state": "working",
        "target": target,
        "block": {
            "id": block["id"],
            "program_id": block["program_id"],
            "program_name": block["program_name"],
            "old_media_item_id": block["media_item_id"],
            "planned_duration_s": block["planned_duration_s"],
            "old_duration_s": block["current_media_duration_s"],
        },
        "started_at": now().isoformat(),
    }
    atomic_write(state)

    candidate = existing_candidate(block, target["date"])
    if candidate:
        state["candidate"] = {"media_id": candidate["id"], "reused": True}
    else:
        generated = generate_candidate(block, target["date"], args.timeout_minutes)
        state["candidate"] = {
            "media_id": generated["media_id"],
            "duration_s": generated.get("duration_s"),
            "reused": False,
        }
        atomic_write(state)

    swap = replace(block, state["candidate"]["media_id"], target["date"])
    state["swap"] = swap
    state["state"] = "replaced" if swap.get("changed") else "no_change"

    try:
        refresh_readiness(max(4, args.horizon_days + 1))
        state["compile"] = compile_if_ready(target["date"])
    except Exception as exc:
        state["compile"] = {"returncode": None, "deferred": True, "error": str(exc)[:800]}

    state["finished_at"] = now().isoformat()
    atomic_write(state)
    return 0


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
