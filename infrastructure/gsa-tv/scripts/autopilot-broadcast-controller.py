#!/usr/bin/env python3
"""GSA TV Autopilot V2 — scheduled broadcast controller.

The controller is idempotent and fail-closed. It never invents schedule
readiness, never overrides a manual pause/live take, and only uses supported
Control Plane jobs (stream_start/stream_stop).

Activation is explicitly gated by GSA_TV_BROADCAST_AUTOMATION_ENABLED.
"""
import datetime as dt
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from zoneinfo import ZoneInfo

TZ = ZoneInfo("America/Sao_Paulo")
ROOT = Path(os.environ.get("GSA_TV_ROOT", "/opt/gsa-tv"))
STATE_DIR = ROOT / "runtime" / "autopilot"
STATE_FILE = STATE_DIR / "broadcast-controller.json"

spec = importlib.util.spec_from_file_location(
    "production", Path(__file__).with_name("night-production.py")
)
production = importlib.util.module_from_spec(spec)
spec.loader.exec_module(production)


def enabled():
    return str(os.environ.get("GSA_TV_BROADCAST_AUTOMATION_ENABLED", "false")).strip().lower() in {
        "1", "true", "yes", "on"
    }


def atomic_write(payload):
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    tmp.replace(STATE_FILE)


def read_previous():
    try:
        value = json.loads(STATE_FILE.read_text())
        return value if isinstance(value, dict) else {}
    except (OSError, ValueError, TypeError):
        return {}


def local_now():
    return dt.datetime.now(TZ)


def parse_clock(value, default):
    raw = str(value or default).strip()
    parts = raw.split(":")
    if len(parts) not in (2, 3):
        raise ValueError(f"Horário inválido: {raw}")
    hour, minute = int(parts[0]), int(parts[1])
    second = int(parts[2]) if len(parts) == 3 else 0
    if not (0 <= hour <= 23 and 0 <= minute <= 59 and 0 <= second <= 59):
        raise ValueError(f"Horário inválido: {raw}")
    return dt.time(hour, minute, second)


def phase(
    moment,
    start=dt.time(6, 0),
    stop=dt.time(23, 59),
    prepare_minutes=10,
    prepare_start=None,
):
    seconds = moment.hour * 3600 + moment.minute * 60 + moment.second
    start_s = start.hour * 3600 + start.minute * 60 + start.second
    stop_s = stop.hour * 3600 + stop.minute * 60 + stop.second
    if start_s >= stop_s:
        raise ValueError("A política atual exige janela on-air no mesmo dia")
    if prepare_start is not None:
        prepare_s = (
            prepare_start.hour * 3600 +
            prepare_start.minute * 60 +
            prepare_start.second
        )
        if prepare_s > start_s:
            raise ValueError("preflight_start não pode ser posterior a on_air_start")
    else:
        prepare_s = max(0, start_s - max(1, int(prepare_minutes)) * 60)
    if prepare_s <= seconds < start_s:
        return "prepare"
    if start_s <= seconds < stop_s:
        return "on_air"
    return "off_air"


def decide(window, state):
    desired = str(state.get("desired_state") or "unknown")
    signal = str(state.get("signal_state") or "unknown")
    playout = str(state.get("playout_state") or "unknown")

    if window == "prepare":
        return "prepare"

    if window == "on_air":
        if desired == "paused":
            return "hold_manual_pause"
        if playout.startswith("manual-live:") and signal == "sending":
            return "preserve_manual_live"
        if desired == "running" and signal == "sending":
            return "noop_on_air"
        return "start"

    if playout.startswith("manual-live:") and signal == "sending":
        return "hold_manual_live_overtime"
    if desired == "stopped" and signal == "stopped" and playout == "off_air":
        return "noop_off_air"
    return "stop"


def runtime_state():
    rows = production.query(
        """select desired_state,signal_state,playout_state,last_heartbeat_at,
                  last_error,config
             from public.gsa_tv_channels
            where id='ch-main'
            limit 1"""
    )
    if not rows:
        raise RuntimeError("Canal ch-main ausente")
    return rows[0]


def policy(state):
    config = state.get("config") or {}
    schedule = config.get("broadcast_schedule_policy") or {}
    return {
        "revision": schedule.get("revision"),
        "start": parse_clock(schedule.get("on_air_start"), "06:00:00"),
        "stop": parse_clock(schedule.get("stream_stop"), "23:59:00"),
        "prepare_start": (
            parse_clock(schedule.get("preflight_start"), "05:59:00")
            if schedule.get("preflight_start")
            else None
        ),
        "prepare_minutes": int(os.environ.get("GSA_TV_BROADCAST_PREPARE_MINUTES", "10")),
    }


def control_plane_running():
    result = subprocess.run(
        ["docker", "inspect", "-f", "{{.State.Running}}", "gsa-tv-control-plane"],
        capture_output=True,
        text=True,
        timeout=8,
    )
    return result.returncode == 0 and result.stdout.strip().lower() == "true"


def heartbeat_fresh(state, moment):
    raw = state.get("last_heartbeat_at")
    if not raw:
        return False
    try:
        heartbeat = dt.datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        age = (moment.astimezone(dt.timezone.utc) - heartbeat.astimezone(dt.timezone.utc)).total_seconds()
        return 0 <= age <= 120
    except (TypeError, ValueError):
        return False


def enqueue(job_type, payload):
    pending = production.query(
        """select id,status from public.gsa_tv_jobs
            where channel_id='ch-main'
              and job_type=$1
              and status in ('pending','running')
            order by created_at desc
            limit 1""",
        [job_type],
    )
    if pending:
        return pending[0]["id"], True
    rows = production.query(
        """insert into public.gsa_tv_jobs(channel_id,job_type,payload)
           values('ch-main',$1,$2::jsonb)
           returning id""",
        [job_type, json.dumps(payload)],
    )
    return rows[0]["id"], False


def wait_job(job_id, timeout=150):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        rows = production.query(
            "select status,error_message from public.gsa_tv_jobs where id=$1",
            [job_id],
        )
        if not rows:
            raise RuntimeError(f"Job desapareceu: {job_id}")
        row = rows[0]
        if row["status"] == "completed":
            return
        if row["status"] in ("failed", "cancelled"):
            raise RuntimeError(
                f"Job {job_id} terminou como {row['status']}: {row.get('error_message') or ''}"
            )
        time.sleep(2)
    raise TimeoutError(f"Job sem confirmação: {job_id}")


def audit(action, details):
    production.query(
        """insert into public.gsa_tv_audit_log(
             channel_id,actor,action,resource_type,resource_id,details
           ) values(
             'ch-main','autopilot-broadcast-controller',$1,
             'automation','broadcast_controller',$2::jsonb
           )""",
        [action, json.dumps(details, ensure_ascii=False)],
    )


def run():
    moment = local_now()
    base = {
        "type": "gsa_tv_autopilot_broadcast_controller",
        "checked_at": moment.isoformat(),
        "enabled": enabled(),
    }

    if not enabled():
        base.update(state="disabled", reason="GSA_TV_BROADCAST_AUTOMATION_ENABLED=false")
        atomic_write(base)
        return 0

    if not control_plane_running():
        base.update(state="blocked", reason="control_plane_not_running")
        atomic_write(base)
        return 2

    current = runtime_state()
    if not heartbeat_fresh(current, moment):
        base.update(state="blocked", reason="stale_control_plane_heartbeat")
        atomic_write(base)
        return 2

    if current.get("last_error"):
        base.update(state="blocked", reason="channel_last_error", error=str(current["last_error"])[:500])
        atomic_write(base)
        return 2

    p = policy(current)
    window = phase(
        moment,
        p["start"],
        p["stop"],
        p["prepare_minutes"],
        p["prepare_start"],
    )
    action = decide(window, current)
    base.update(
        state="checking",
        window=window,
        action=action,
        policy_revision=p["revision"],
        on_air_start=p["start"].isoformat(),
        preflight_start=p["prepare_start"].isoformat() if p["prepare_start"] else None,
        stream_stop=p["stop"].isoformat(),
        desired_state=current.get("desired_state"),
        signal_state=current.get("signal_state"),
        playout_state=current.get("playout_state"),
    )

    if action == "prepare":
        previous = read_previous()
        if previous.get("state") == "prepared" and previous.get("prepared_date") == moment.date().isoformat():
            base.update(
                state="prepared",
                prepared_date=moment.date().isoformat(),
                reason="already_prepared_in_current_window",
            )
            atomic_write(base)
            return 0
        try:
            production.compile_ready(moment.date().isoformat())
            base.update(state="prepared", prepared_date=moment.date().isoformat())
            audit("broadcast_prepared", base)
            atomic_write(base)
            return 0
        except Exception as exc:
            base.update(state="blocked", reason="prepare_failed", error=str(exc)[:700])
            audit("broadcast_prepare_blocked", base)
            atomic_write(base)
            return 2

    if action in {
        "hold_manual_pause",
        "preserve_manual_live",
        "hold_manual_live_overtime",
        "noop_on_air",
        "noop_off_air",
    }:
        state_name = "held" if action.startswith("hold_") or action.startswith("preserve_") else "healthy"
        base.update(state=state_name, finished_at=local_now().isoformat())
        atomic_write(base)
        return 0

    try:
        if action == "start":
            previous = read_previous()
            prepared_at = None
            try:
                if previous.get("prepared_date") == moment.date().isoformat():
                    prepared_at = dt.datetime.fromisoformat(
                        str(previous.get("checked_at") or "").replace("Z", "+00:00")
                    )
            except (TypeError, ValueError):
                prepared_at = None
            prepared_fresh = bool(
                previous.get("state") == "prepared"
                and prepared_at
                and 0 <= (
                    moment.astimezone(dt.timezone.utc) -
                    prepared_at.astimezone(dt.timezone.utc)
                ).total_seconds() <= 300
            )
            # If 05:59 preflight is fresh, stream_start performs the final
            # fail-closed compile against the current published schedule.
            if not prepared_fresh:
                production.compile_ready(moment.date().isoformat())
            job_type = "stream_start"
        elif action == "stop":
            job_type = "stream_stop"
        else:
            raise RuntimeError(f"Ação desconhecida: {action}")

        job_id, reused = enqueue(
            job_type,
            {
                "source": "autopilot-broadcast-controller",
                "window": window,
                "date": moment.date().isoformat(),
                "policy_revision": p["revision"],
            },
        )
        wait_job(job_id)
        after = runtime_state()

        if action == "start":
            ok = after.get("desired_state") == "running" and after.get("signal_state") == "sending"
        else:
            ok = (
                after.get("desired_state") == "stopped"
                and after.get("signal_state") == "stopped"
                and after.get("playout_state") == "off_air"
            )
        if not ok:
            raise RuntimeError(
                "Transição concluída sem estado final esperado: "
                f"{after.get('desired_state')}/{after.get('signal_state')}/{after.get('playout_state')}"
            )

        base.update(
            state="transition_confirmed",
            job_type=job_type,
            job_id=str(job_id),
            reused_job=reused,
            desired_state=after.get("desired_state"),
            signal_state=after.get("signal_state"),
            playout_state=after.get("playout_state"),
            finished_at=local_now().isoformat(),
        )
        audit("broadcast_transition_confirmed", base)
        atomic_write(base)
        return 0
    except Exception as exc:
        base.update(state="failed", reason="transition_failed", error=str(exc)[:700], finished_at=local_now().isoformat())
        try:
            audit("broadcast_transition_failed", base)
        except Exception:
            pass
        atomic_write(base)
        return 1


def main():
    try:
        return run()
    except Exception as exc:
        payload = {
            "type": "gsa_tv_autopilot_broadcast_controller",
            "state": "failed",
            "reason": "controller_exception",
            "error": str(exc)[:700],
            "checked_at": local_now().isoformat(),
        }
        try:
            atomic_write(payload)
        except Exception:
            pass
        print(json.dumps(payload, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
