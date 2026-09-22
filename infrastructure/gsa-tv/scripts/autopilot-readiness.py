#!/usr/bin/env python3
"""GSA TV Autopilot V2 — rolling readiness horizon.

Read-only by default. It inspects published schedule blocks and the media already
linked to them, then writes a machine-readable coverage snapshot. It does not
approve media, alter links, publish playlists, or start/stop transmission.
"""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import subprocess
import sys
from zoneinfo import ZoneInfo

TZ = ZoneInfo("America/Sao_Paulo")
CHANNEL_ID = os.environ.get("GSA_TV_CHANNEL_ID", "ch-main")
ROOT = Path(os.environ.get("GSA_TV_ROOT", "/opt/gsa-tv"))
STATE_DIR = ROOT / "runtime" / "autopilot"
STATE_FILE = STATE_DIR / "readiness-horizon.json"

PG = r"""const{Pool}=require('pg');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',async()=>{const p=new Pool({connectionString:process.env.DATABASE_URL});try{const q=JSON.parse(s);const r=await p.query(q.sql,q.params);console.log(JSON.stringify(r.rows||[]))}catch(e){console.error(e.message);process.exitCode=1}finally{await p.end()}});"""


def now():
    return dt.datetime.now(TZ)


def query(sql, params=None):
    payload = json.dumps({"sql": sql, "params": params or []})
    result = subprocess.run(
        ["docker", "exec", "-i", "gsa-tv-control-plane", "node", "-e", PG],
        input=payload,
        text=True,
        capture_output=True,
        timeout=30,
    )
    if result.returncode != 0:
        raise RuntimeError((result.stderr or result.stdout or "database query failed").strip())
    return json.loads(result.stdout or "[]")


def parse_ts(value):
    if not value:
        return None
    value = str(value).replace("Z", "+00:00")
    parsed = dt.datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed


def block_end(date, start_s, duration_s):
    midnight = dt.datetime.combine(date, dt.time(), TZ)
    return midnight + dt.timedelta(seconds=float(start_s) + float(duration_s))


def inspect_day(day):
    versions = query(
        """select id,state,version,updated_at
             from public.gsa_tv_schedule_versions
            where channel_id=$1 and broadcast_date=$2::date
            order by case when state='published' then 0 else 1 end, version desc
            limit 1""",
        [CHANNEL_ID, day.isoformat()],
    )
    if not versions:
        return {
            "date": day.isoformat(),
            "state": "schedule_missing",
            "scheduled_blocks": 0,
            "eligible_blocks": 0,
            "coverage_pct": 0.0,
            "issues": [{"issue": "schedule_missing"}],
        }

    version = versions[0]
    rows = query(
        """select
               b.id,
               b.position,
               b.block_type,
               b.program_id,
               p.name as program_name,
               b.live_source_id,
               b.is_reprise,
               b.metadata as block_metadata,
               b.planned_start_offset_s,
               b.planned_duration_s,
               coalesce(dm.id,em.id,pm.id,cm.id) as media_item_id,
               coalesce(dm.state,em.state,pm.state,cm.state) as media_state,
               coalesce(dm.approval_state,em.approval_state,pm.approval_state,cm.approval_state) as approval_state,
               coalesce(dm.rights_ok,em.rights_ok,pm.rights_ok,cm.rights_ok) as rights_ok,
               coalesce(dm.rights_expires_at,em.rights_expires_at,pm.rights_expires_at,cm.rights_expires_at) as rights_expires_at,
               coalesce(dm.duration_s,em.duration_s,pm.duration_s,cm.duration_s) as media_duration_s,
               coalesce(dm.drive_path,em.drive_path,pm.drive_path,cm.drive_path) as drive_path
           from public.gsa_tv_program_blocks b
           left join public.gsa_tv_programs p on p.id=b.program_id
           left join public.gsa_tv_media_items dm
                  on dm.id=b.media_item_id and dm.channel_id=$1
           left join public.gsa_tv_episodes ep on ep.id=b.episode_id
           left join public.gsa_tv_media_items em
                  on em.id=ep.media_item_id and em.channel_id=$1
           left join lateral (
             select m.*
               from public.gsa_tv_series se
               join public.gsa_tv_episodes e on e.series_id=se.id
               join public.gsa_tv_media_items m on m.id=e.media_item_id
              where b.media_item_id is null
                and b.episode_id is null
                and b.program_id is not null
                and se.program_id=b.program_id
                and m.channel_id=$1
              order by case when b.is_reprise then e.last_run_at else e.first_run_at end nulls first,
                       e.season_number,e.episode_number
              limit 1
           ) pm on true
           left join lateral (
             select m.*
               from public.gsa_tv_ad_assets aa
               join public.gsa_tv_media_items m on m.id=aa.media_item_id
               join public.gsa_tv_ad_campaigns c on c.id=aa.campaign_id
              where b.campaign_id is not null
                and aa.campaign_id=b.campaign_id
                and c.status='active'
                and (($3::date + make_interval(secs=>b.planned_start_offset_s)) at time zone $4)
                    between c.starts_at and c.ends_at
                and m.channel_id=$1
                and m.state='ready'
                and m.rights_ok
                and m.approval_state='approved'
              order by aa.weight desc,m.updated_at asc
              limit 1
           ) cm on true
          where b.schedule_version_id=$2
          order by b.planned_start_offset_s,b.position""",
        [CHANNEL_ID, version["id"], day.isoformat(), "America/Sao_Paulo"],
    )

    scheduled_s = 0.0
    eligible_s = 0.0
    actual_content_s = 0.0
    authorized_fill_s = 0.0
    eligible_blocks = 0
    issues = []

    for row in rows:
        duration = float(row.get("planned_duration_s") or 0)
        scheduled_s += max(0.0, duration)
        issue = None

        block_metadata = row.get("block_metadata") or {}
        required_slot_duration = float(block_metadata.get("required_slot_duration_s") or 0)
        if required_slot_duration > 0 and duration + 0.001 < required_slot_duration:
            issues.append({
                "block_id": row["id"],
                "program": row.get("program_name"),
                "issue": "slot_duration_contract_violation",
                "planned_duration_s": duration,
                "required_duration_s": required_slot_duration,
                "shortfall_s": round(required_slot_duration - duration, 3),
            })
            continue

        if row.get("block_type") == "live" and row.get("live_source_id"):
            eligible = True
            actual = duration
        else:
            eligible = True
            if not row.get("media_item_id"):
                eligible = False
                issue = "missing_media"
            elif row.get("media_state") != "ready":
                eligible = False
                issue = "media_not_ready"
            elif row.get("approval_state") != "approved":
                eligible = False
                issue = "media_not_approved"
            elif not row.get("rights_ok"):
                eligible = False
                issue = "rights_not_confirmed"
            else:
                expiry = parse_ts(row.get("rights_expires_at"))
                if expiry and expiry < block_end(day, row.get("planned_start_offset_s") or 0, duration):
                    eligible = False
                    issue = "rights_expire_before_block_end"

            actual = min(duration, float(row.get("media_duration_s") or 0)) if eligible else 0.0

        if eligible:
            eligible_blocks += 1
            eligible_s += duration
            actual_content_s += max(0.0, actual)
            if row.get("block_type") != "live":
                media_duration = float(row.get("media_duration_s") or 0)
                metadata = row.get("block_metadata") or {}
                library = bool(row.get("is_reprise") or metadata.get("content_mode") == "library")
                allow_fill = metadata.get("allow_continuity_fill") is True
                allow_trim = metadata.get("allow_trim") is True

                if media_duration + 1 < duration:
                    if allow_fill:
                        authorized_fill_s += max(0.0, duration - media_duration)
                    else:
                        issues.append({
                            "block_id": row["id"],
                            "program": row.get("program_name"),
                            "issue": "library_composition_required" if library else "content_shortfall",
                            "planned_start_offset_s": row.get("planned_start_offset_s"),
                            "planned_duration_s": duration,
                            "media_item_id": row.get("media_item_id"),
                            "media_duration_s": media_duration,
                            "shortfall_s": round(duration - media_duration, 3),
                        })
                elif media_duration > duration + 1 and not allow_trim:
                    issues.append({
                        "block_id": row["id"],
                        "program": row.get("program_name"),
                        "issue": "content_overlong",
                        "planned_start_offset_s": row.get("planned_start_offset_s"),
                        "planned_duration_s": duration,
                        "media_item_id": row.get("media_item_id"),
                        "media_duration_s": media_duration,
                        "overrun_s": round(media_duration - duration, 3),
                    })
        else:
            issues.append({
                "block_id": row["id"],
                "program": row.get("program_name"),
                "issue": issue,
                "planned_start_offset_s": row.get("planned_start_offset_s"),
                "planned_duration_s": duration,
                "media_item_id": row.get("media_item_id"),
            })

    coverage = (eligible_s / scheduled_s * 100.0) if scheduled_s else 0.0
    content_coverage = (actual_content_s / scheduled_s * 100.0) if scheduled_s else 0.0
    hard_issues = list(issues)

    return {
        "date": day.isoformat(),
        "schedule_version_id": version["id"],
        "schedule_state": version["state"],
        "state": "ready" if version["state"] == "published" and not hard_issues else "incomplete",
        "scheduled_blocks": len(rows),
        "eligible_blocks": eligible_blocks,
        "scheduled_duration_s": round(scheduled_s, 3),
        "eligible_duration_s": round(eligible_s, 3),
        "actual_content_duration_s": round(actual_content_s, 3),
        "authorized_continuity_fill_s": round(authorized_fill_s, 3),
        "coverage_pct": round(coverage, 2),
        "content_coverage_pct": round(content_coverage, 2),
        "issue_count": len(issues),
        "hard_issue_count": len(hard_issues),
        "issues": issues,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=7)
    parser.add_argument("--start-date")
    parser.add_argument("--require-next-day-ready", action="store_true")
    args = parser.parse_args()

    if args.days < 1 or args.days > 30:
        raise SystemExit("--days must be between 1 and 30")

    start = dt.date.fromisoformat(args.start_date) if args.start_date else now().date()
    days = [inspect_day(start + dt.timedelta(days=i)) for i in range(args.days)]

    report = {
        "type": "gsa_tv_autopilot_readiness_horizon",
        "channel_id": CHANNEL_ID,
        "generated_at": now().isoformat(),
        "start_date": start.isoformat(),
        "days": args.days,
        "ready_days": sum(1 for x in days if x["state"] == "ready"),
        "days_detail": days,
    }

    STATE_DIR.mkdir(parents=True, exist_ok=True)
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    tmp.replace(STATE_FILE)
    print(json.dumps(report, ensure_ascii=False))

    if args.require_next_day_ready:
        tomorrow = (now().date() + dt.timedelta(days=1)).isoformat()
        day = next((x for x in days if x["date"] == tomorrow), None)
        if not day or day["state"] != "ready" or day["content_coverage_pct"] < 99.0:
            return 2
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(json.dumps({"type": "gsa_tv_autopilot_readiness_error", "error": str(exc)[:800]}), file=sys.stderr)
        sys.exit(1)
