#!/usr/bin/env python3
"""GSA TV Autopilot V2 — continuous content factory dispatcher.

This process does not implement a second production pipeline. It refreshes the
rolling readiness snapshot, selects the nearest future date with unfilled
blocks, and invokes the existing validated night-production pipeline in a
bounded, low-priority cycle.

It never starts/stops the broadcast chain and never replaces media already
linked to a block. Duration-shortfall remediation is intentionally left to the
separate duration engine.
"""
import argparse
import datetime as dt
import fcntl
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
from zoneinfo import ZoneInfo

TZ = ZoneInfo("America/Sao_Paulo")
ROOT = Path(os.environ.get("GSA_TV_ROOT", "/opt/gsa-tv"))
BIN = ROOT / "bin"
STATE_DIR = ROOT / "runtime" / "autopilot"
READINESS_FILE = STATE_DIR / "readiness-horizon.json"
FACTORY_FILE = STATE_DIR / "content-factory.json"
LOCK_FILE = "/tmp/gsa-tv-autopilot-content-factory.lock"

ACTIONABLE_ISSUES = {"missing_media"}


def now():
    return dt.datetime.now(TZ)


def atomic_write(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    tmp.replace(path)


def process_ok(command):
    return subprocess.run(
        command,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        timeout=8,
    ).returncode == 0


def runtime_ready():
    for name in ("gsa-tv-control-plane", "gsa-tv-ffplayout"):
        if not process_ok(["docker", "inspect", "-f", "{{.State.Running}}", name]):
            return False, f"{name}_missing"
        result = subprocess.run(
            ["docker", "inspect", "-f", "{{.State.Running}}", name],
            capture_output=True,
            text=True,
            timeout=8,
        )
        if result.stdout.strip().lower() != "true":
            return False, f"{name}_not_running"
    return True, None


def available_memory_mb():
    try:
        for line in Path("/proc/meminfo").read_text().splitlines():
            if line.startswith("MemAvailable:"):
                return int(line.split()[1]) / 1024.0
    except Exception:
        pass
    return None


def resources_allow_start():
    cores = max(1, os.cpu_count() or 1)
    try:
        load1 = os.getloadavg()[0]
    except (AttributeError, OSError):
        load1 = 0.0
    max_load = float(os.environ.get("GSA_TV_AUTOPILOT_MAX_LOAD", str(cores * 0.85)))
    min_mem_mb = float(os.environ.get("GSA_TV_AUTOPILOT_MIN_AVAILABLE_MB", "2048"))
    mem_mb = available_memory_mb()
    reasons = []
    if load1 > max_load:
        reasons.append(f"load_high:{load1:.2f}>{max_load:.2f}")
    if mem_mb is not None and mem_mb < min_mem_mb:
        reasons.append(f"memory_low:{mem_mb:.0f}<{min_mem_mb:.0f}MB")
    return not reasons, {"load1": round(load1, 2), "max_load": round(max_load, 2), "mem_available_mb": None if mem_mb is None else round(mem_mb), "reasons": reasons}


def in_transition_quiet_window(moment):
    # Protect the critical handoff around the 06:00 morning transition.
    minute = moment.hour * 60 + moment.minute
    return (5 * 60 + 40) <= minute <= (6 * 60 + 20)


def refresh_readiness(days):
    command = [
        sys.executable,
        str(BIN / "autopilot-readiness.py"),
        "--days",
        str(days),
        "--start-date",
        now().date().isoformat(),
    ]
    subprocess.run(command, check=True, timeout=180, stdout=subprocess.DEVNULL)


def load_readiness():
    if not READINESS_FILE.is_file():
        raise RuntimeError("readiness snapshot missing")
    return json.loads(READINESS_FILE.read_text())


def select_target(report, horizon_days):
    today = now().date()
    candidates = []
    blockers = []
    for day in report.get("days_detail", []):
        try:
            date = dt.date.fromisoformat(day["date"])
        except Exception:
            continue
        delta = (date - today).days
        if delta < 1 or delta > horizon_days:
            continue

        issues = day.get("issues") or []
        actionable = [i for i in issues if i.get("issue") in ACTIONABLE_ISSUES]
        shortfalls = [i for i in issues if i.get("issue") == "content_shortfall"]
        non_actionable = [i for i in issues if i.get("issue") not in ACTIONABLE_ISSUES | {"content_shortfall"}]

        if actionable and day.get("schedule_state") == "published":
            candidates.append((delta, date, day, actionable))
        if shortfalls or non_actionable:
            blockers.append({
                "date": date.isoformat(),
                "shortfalls": len(shortfalls),
                "non_actionable": [x.get("issue") for x in non_actionable],
            })

    if not candidates:
        return None, blockers
    candidates.sort(key=lambda item: item[0])
    delta, date, day, actionable = candidates[0]
    return {
        "date": date.isoformat(),
        "days_ahead": delta,
        "missing_blocks": len(actionable),
        "coverage_pct_before": day.get("coverage_pct"),
        "content_coverage_pct_before": day.get("content_coverage_pct"),
    }, blockers


def terminate_group(child):
    try:
        os.killpg(child.pid, signal.SIGTERM)
        child.wait(timeout=30)
    except Exception:
        try:
            os.killpg(child.pid, signal.SIGKILL)
        except Exception:
            pass


def run_fallback_engine():
    command = [
        sys.executable,
        str(BIN / "autopilot-fallback-engine.py"),
    ]
    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        timeout=300,
    )
    fallback_state = STATE_DIR / "fallback-engine.json"
    payload = None
    if fallback_state.is_file():
        try:
            payload = json.loads(fallback_state.read_text())
        except Exception:
            payload = None
    return {
        "returncode": result.returncode,
        "stdout_tail": (result.stdout or "")[-1200:],
        "stderr_tail": (result.stderr or "")[-1200:],
        "fallback_engine": payload,
    }


def run_duration_engine(horizon_days, cycle_minutes):
    command = [
        sys.executable,
        str(BIN / "autopilot-duration-engine.py"),
        "--horizon-days",
        str(horizon_days),
        "--timeout-minutes",
        str(cycle_minutes),
    ]
    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        timeout=cycle_minutes * 60 + 120,
    )
    duration_state = STATE_DIR / "duration-engine.json"
    payload = None
    if duration_state.is_file():
        try:
            payload = json.loads(duration_state.read_text())
        except Exception:
            payload = None
    return {
        "returncode": result.returncode,
        "stdout_tail": (result.stdout or "")[-1200:],
        "stderr_tail": (result.stderr or "")[-1200:],
        "duration_engine": payload,
    }


def run_production(target, cycle_minutes):
    log_path = STATE_DIR / f"content-factory-{target['date']}.log"
    command = [
        sys.executable,
        str(BIN / "night-production.py"),
        "--force",
        "--date",
        target["date"],
        "--max-runtime-minutes",
        str(cycle_minutes),
    ]
    with log_path.open("a") as log:
        child = subprocess.Popen(
            command,
            stdout=log,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        try:
            returncode = child.wait(timeout=cycle_minutes * 60 + 90)
        except subprocess.TimeoutExpired:
            terminate_group(child)
            return 124, log_path
    return returncode, log_path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--horizon-days", type=int, default=3)
    parser.add_argument("--cycle-minutes", type=int, default=40)
    args = parser.parse_args()

    if not 1 <= args.horizon_days <= 7:
        raise SystemExit("--horizon-days must be between 1 and 7")
    if not 10 <= args.cycle_minutes <= 120:
        raise SystemExit("--cycle-minutes must be between 10 and 120")

    STATE_DIR.mkdir(parents=True, exist_ok=True)
    lock = open(LOCK_FILE, "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        atomic_write(FACTORY_FILE, {
            "state": "skipped",
            "reason": "factory_cycle_already_running",
            "checked_at": now().isoformat(),
        })
        return 0

    state = {
        "state": "checking",
        "checked_at": now().isoformat(),
        "horizon_days": args.horizon_days,
        "cycle_minutes": args.cycle_minutes,
    }
    atomic_write(FACTORY_FILE, state)

    ready, runtime_reason = runtime_ready()
    if not ready:
        state.update(state="blocked", reason=runtime_reason, finished_at=now().isoformat())
        atomic_write(FACTORY_FILE, state)
        return 2

    if in_transition_quiet_window(now()):
        state.update(state="skipped", reason="morning_transition_quiet_window", finished_at=now().isoformat())
        atomic_write(FACTORY_FILE, state)
        return 0

    resource_ok, resources = resources_allow_start()
    state["resources"] = resources
    if not resource_ok:
        state.update(state="deferred", reason="resource_guard", finished_at=now().isoformat())
        atomic_write(FACTORY_FILE, state)
        return 0

    refresh_readiness(max(args.horizon_days + 1, 4))
    report = load_readiness()

    # Final continuity fallback is evaluated every cycle but remains a no-op
    # until the late D0 activation window opens.
    try:
        fallback_cycle = run_fallback_engine()
        state["fallback_cycle"] = fallback_cycle
        if fallback_cycle["returncode"] in (0, 2):
            refresh_readiness(max(args.horizon_days + 1, 4))
            report = load_readiness()
    except subprocess.TimeoutExpired:
        state["fallback_cycle"] = {"returncode": 124, "state": "timeout"}

    target, blockers = select_target(report, args.horizon_days)
    state["blockers"] = blockers

    if not target:
        shortfalls = sum(x.get("shortfalls", 0) for x in blockers)
        if shortfalls:
            state.update(
                state="repairing_duration",
                reason="no_missing_media_blocks",
                shortfall_blocks=shortfalls,
                started_at=now().isoformat(),
            )
            atomic_write(FACTORY_FILE, state)
            try:
                duration = run_duration_engine(args.horizon_days, args.cycle_minutes)
                state["duration_cycle"] = duration
                state["state"] = (
                    "duration_cycle_completed"
                    if duration["returncode"] == 0
                    else "duration_cycle_failed"
                )
            except subprocess.TimeoutExpired:
                state["state"] = "duration_cycle_timeout"
                state["duration_cycle"] = {"returncode": 124}
            state["finished_at"] = now().isoformat()
            atomic_write(FACTORY_FILE, state)
            return 0

        state.update(
            state="idle",
            reason="no_missing_media_blocks",
            shortfall_blocks=0,
            finished_at=now().isoformat(),
        )
        atomic_write(FACTORY_FILE, state)
        return 0

    state.update(state="producing", target=target, started_at=now().isoformat())
    atomic_write(FACTORY_FILE, state)

    code, log_path = run_production(target, args.cycle_minutes)
    state.update(
        returncode=code,
        log_path=str(log_path),
        finished_at=now().isoformat(),
    )

    # Always refresh after a bounded cycle so the next dispatcher decision is
    # based on the actual post-production state.
    try:
        refresh_readiness(max(args.horizon_days + 1, 4))
        after = load_readiness()
        selected_after = next((x for x in after.get("days_detail", []) if x.get("date") == target["date"]), None)
        state["target_after"] = selected_after
    except Exception as exc:
        state["readiness_refresh_error"] = str(exc)[:500]

    if code == 0:
        state["state"] = "cycle_completed"
    elif code == 2:
        state["state"] = "cycle_incomplete"
    elif code == 124:
        state["state"] = "cycle_timeout"
    else:
        state["state"] = "cycle_failed"

    atomic_write(FACTORY_FILE, state)
    return 0 if code in (0, 2, 124) else code


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        atomic_write(FACTORY_FILE, {
            "state": "failed",
            "error": str(exc)[:800],
            "finished_at": now().isoformat(),
        })
        raise
