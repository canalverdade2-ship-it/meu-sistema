import { runSshScript } from './ssh2-run.mjs';

const guardianScript = `#!/usr/bin/env python3
import sys
import os
import time
import json
import re
import signal
import urllib.request
import subprocess

LOG_FILE = "/var/log/gsa-process-guardian.log"
STATE_FILE = "/var/run/gsa-process-guardian-state.json"
HLS_PLAYLIST = "/opt/gsa-tv/runtime/hls/program.m3u8"
ENCODER_STATUS_URL = "http://127.0.0.1:9210/v1/status"
ENCODER_TOKEN = "222d718911511702a4c813c427fdbab3e70c908d39f5c550c9594f8d3938cd9e"

CPU_THRESHOLD = float(os.environ.get("GUARDIAN_CPU_THRESHOLD", 80.0))
TIME_THRESHOLD = float(os.environ.get("GUARDIAN_TIME_THRESHOLD", 180.0))

PROTECTED_PATTERNS = [
    "systemd", "sshd", "dockerd", "containerd", "postgres", "redis",
    "gotrue", "realtime", "ffplayout", "encoder-engine", "control-plane",
    "watchdog", "gsa-process-guardian", "journald", "cloudflared",
    "n8n", "evolution-api", "gsa-auth-session", "deno", "storage",
    "oracle-cloud-agent", "agent-updater", "auditd", "rsyslog", "chrony",
    "dbus", "polkit", "fail2ban", "backup", "tar", "gzip", "xz", "zstd", "ssh"
]

def log(msg, level="INFO"):
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    line = str(ts) + " [" + str(level) + "] " + str(msg) + "\\n"
    sys.stdout.write(line)
    try:
        with open(LOG_FILE, "a") as f:
            f.write(line)
    except Exception as e:
        sys.stderr.write("Failed to write to log: " + str(e) + "\\n")

def load_state():
    try:
        if os.path.exists(STATE_FILE):
            with open(STATE_FILE, "r") as f:
                return json.load(f)
    except Exception:
        pass
    return {}

def save_state(state):
    try:
        tmp = STATE_FILE + ".tmp"
        with open(tmp, "w") as f:
            json.dump(state, f)
        os.replace(tmp, STATE_FILE)
    except Exception as e:
        sys.stderr.write("Failed to save state: " + str(e) + "\\n")

def check_encoder_health(state):
    status_data = {}
    try:
        req = urllib.request.Request(
            ENCODER_STATUS_URL,
            headers={"Authorization": "Bearer " + ENCODER_TOKEN}
        )
        with urllib.request.urlopen(req, timeout=4) as resp:
            if resp.status == 200:
                status_data = json.loads(resp.read().decode())
    except Exception as e:
        log("[ENCODER HEALTH] API unreachable: " + str(e), "ALERT")

    hls_fresh = status_data.get("hls_fresh", False)
    outer_running = status_data.get("outer_running", False)
    producer_running = status_data.get("producer_running", False)
    hls_age = status_data.get("hls_age_s", None)

    if not outer_running or not producer_running or not hls_fresh:
        log(f"[ENCODER HEALTH] Stream degraded: outer={outer_running}, producer={producer_running}, fresh={hls_fresh}, age={hls_age}s", "ALERT")

    now = time.time()
    current_seq = None
    try:
        if os.path.exists(HLS_PLAYLIST):
            with open(HLS_PLAYLIST, "r") as f:
                content = f.read()
            m = re.search(r"#EXT-X-MEDIA-SEQUENCE:(\d+)", content)
            if m:
                current_seq = int(m.group(1))
    except Exception as e:
        log("[ENCODER HEALTH] Failed to read HLS playlist: " + str(e), "WARN")

    # Rolling window of (timestamp, sequence)
    history = state.get("hls_history", [])
    if current_seq is not None:
        # If sequence wrapped or reset (stream restarted/recreated), reset baseline history
        if history and current_seq < history[-1][1]:
            log(f"[ENCODER HEALTH] Sequence reset detected ({history[-1][1]} -> {current_seq}). Resetting baseline.", "INFO")
            history = []

        history.append([now, current_seq])
        # Keep last samples (~3.0 minutes)
        history = [h for h in history if (now - h[0]) <= 180.0]
        state["hls_history"] = history

        # Require a robust window (>= 60s) to absorb discrete segment quantization (+/- 1 segment = 60 frames)
        candidates = [h for h in history if (now - h[0]) >= 60.0]
        if candidates:
            base_time, base_seq = candidates[0]
            dt = now - base_time
            dseq = current_seq - base_seq
            if dt > 0 and dseq >= 0:
                # 2.0s per segment * 30 fps = 60 frames per segment
                # An in-flight segment (currently being written) can cause dseq to be off by up to 1.0 segment
                fps_effective = ((dseq + 0.5) * 60.0) / dt
                fps_max = ((dseq + 1.0) * 60.0) / dt

                if fps_max < 29.5:
                    log(f"[ENCODER HEALTH] Low FPS detected: {fps_effective:.2f} fps (< 29.5) over {dt:.1f}s ({dseq} segments, hls_age: {hls_age}s)", "ALERT")
                else:
                    log(f"[ENCODER HEALTH] Stream FPS healthy: {fps_effective:.2f} fps ({dseq} segments in {dt:.1f}s, hls_fresh={hls_fresh}, hls_age={hls_age}s)", "INFO")
        else:
            elapsed = (now - history[0][0]) if history else 0.0
            log(f"[ENCODER HEALTH] Baseline initializing at HLS sequence #{current_seq} (window: {elapsed:.1f}s / 60s target, hls_fresh={hls_fresh}, hls_age={hls_age}s)", "INFO")

def get_monitored_processes():
    candidates = []
    try:
        out = subprocess.check_output(["ps", "-eo", "pid,psr,comm,args"], text=True)
        pid_map = {}
        for line in out.strip().split("\\n")[1:]:
            parts = line.strip().split(None, 3)
            if len(parts) >= 4:
                p_pid = int(parts[0])
                p_psr = int(parts[1])
                p_comm = parts[2]
                p_args = parts[3]
                pid_map[p_pid] = (p_psr, p_comm, p_args)

        top_out = subprocess.check_output(["top", "-b", "-n", "2", "-d", "1"], text=True)
        sections = top_out.split("top - ")
        target_section = sections[-1] if len(sections) > 1 else sections[0]
        for row in target_section.split("\\n"):
            m = re.match(r"^\\s*(\\d+)\\s+\\S+\\s+\\S+\\s+\\S+\\s+\\S+\\s+\\S+\\s+\\S+\\s+\\S+\\s+([\\d.]+)", row)
            if m:
                t_pid = int(m.group(1))
                t_cpu = float(m.group(2))
                if t_pid in pid_map:
                    psr, comm, args = pid_map[t_pid]
                    is_chromium = bool(re.search(r"chromium|chrome|selenium", args, re.I) or re.search(r"chromium|chrome", comm, re.I))
                    is_core3 = (psr == 3)
                    if (is_chromium or is_core3) and t_pid > 1:
                        is_protected = any(p in args or p in comm for p in PROTECTED_PATTERNS)
                        if not is_protected:
                            candidates.append({
                                "pid": t_pid,
                                "psr": psr,
                                "cpu": t_cpu,
                                "comm": comm,
                                "args": args
                            })
    except Exception as e:
        log("Error querying process tree: " + str(e), "WARN")

    return candidates

def check_and_guard_processes(state):
    now = time.time()
    tracking = state.get("cpu_tracking", {})
    candidates = get_monitored_processes()
    current_high_pids = set()

    for proc in candidates:
        pid = proc["pid"]
        cpu = proc["cpu"]
        pid_str = str(pid)

        if cpu >= CPU_THRESHOLD:
            current_high_pids.add(pid_str)
            if pid_str not in tracking:
                tracking[pid_str] = now
                log(f"[WATCH] High CPU detected: PID {pid} ({proc['comm']} on CPU {proc['psr']}) at {cpu:.1f}% CPU. Tracking initiated.", "WARN")
            else:
                duration = now - tracking[pid_str]
                log(f"[WATCH] PID {pid} ({proc['comm']} on CPU {proc['psr']}) sustained high CPU: {cpu:.1f}% for {duration:.0f}s (threshold: {TIME_THRESHOLD:.0f}s)", "WARN")
                if duration >= TIME_THRESHOLD:
                    log(f"[ACTION] PID {pid} ({proc['comm']} on CPU {proc['psr']}) exceeded {CPU_THRESHOLD:.0f}% CPU for >{TIME_THRESHOLD:.0f}s ({duration:.0f}s). Terminating gracefully (SIGTERM)...", "ALERT")
                    try:
                        os.kill(pid, signal.SIGTERM)
                        time.sleep(3)
                        try:
                            os.kill(pid, 0)
                            log(f"[ACTION] PID {pid} still running after SIGTERM. Sending force kill (SIGKILL)...", "ALERT")
                            os.kill(pid, signal.SIGKILL)
                            time.sleep(1)
                            try:
                                os.kill(pid, 0)
                                log(f"[ACTION] PID {pid} still alive after SIGKILL (zombie or uninterruptible state).", "ALERT")
                            except ProcessLookupError:
                                log(f"[ACTION] PID {pid} force-terminated successfully with SIGKILL.", "INFO")
                        except ProcessLookupError:
                            log(f"[ACTION] PID {pid} terminated gracefully with SIGTERM.", "INFO")
                    except ProcessLookupError:
                        log(f"[ACTION] PID {pid} already exited before signal delivery.", "INFO")
                    except Exception as e:
                        log(f"[ACTION] Error terminating PID {pid}: {e}", "ALERT")

                    tracking.pop(pid_str, None)

    for tracked_pid in list(tracking.keys()):
        if tracked_pid not in current_high_pids:
            log(f"[WATCH] PID {tracked_pid} normalized below {CPU_THRESHOLD:.0f}% CPU or finished. Removed from tracking.", "INFO")
            tracking.pop(tracked_pid, None)

    state["cpu_tracking"] = tracking

def main():
    state = load_state()
    check_encoder_health(state)
    check_and_guard_processes(state)
    save_state(state)

if __name__ == "__main__":
    main()
`;

async function main() {
  const b64 = Buffer.from(guardianScript).toString('base64');
  const script = `
    echo "Writing new /opt/gsa-tv/bin/gsa-process-guardian.sh..."
    echo "${b64}" | base64 -d | sudo tee /opt/gsa-tv/bin/gsa-process-guardian.sh > /dev/null
    sudo chmod +x /opt/gsa-tv/bin/gsa-process-guardian.sh

    echo "Validating python syntax with sudo..."
    sudo python3 -m py_compile /opt/gsa-tv/bin/gsa-process-guardian.sh

    echo "Executing single guardian run manually..."
    sudo /opt/gsa-tv/bin/gsa-process-guardian.sh

    echo "Restarting guardian systemd unit..."
    sudo systemctl daemon-reload
    sudo systemctl restart gsa-process-guardian.timer
  `;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(console.error);
