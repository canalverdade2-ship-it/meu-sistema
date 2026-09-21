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

PROTECTED_PATTERNS = [
    "systemd", "sshd", "dockerd", "containerd", "postgres", "redis",
    "gotrue", "realtime", "ffplayout", "encoder-engine", "control-plane",
    "watchdog", "gsa-process-guardian", "journald", "cloudflared"
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
    encoder_ok = False
    status_data = {}
    try:
        req = urllib.request.Request(
            ENCODER_STATUS_URL,
            headers={"Authorization": "Bearer " + ENCODER_TOKEN}
        )
        with urllib.request.urlopen(req, timeout=4) as resp:
            if resp.status == 200:
                status_data = json.loads(resp.read().decode())
                encoder_ok = True
    except Exception as e:
        log("[ENCODER HEALTH] API unreachable: " + str(e), "ALERT")

    hls_fresh = status_data.get("hls_fresh", False)
    outer_running = status_data.get("outer_running", False)
    producer_running = status_data.get("producer_running", False)
    hls_age = status_data.get("hls_age_s", None)

    if not outer_running or not producer_running or not hls_fresh:
        log("[ENCODER HEALTH] Stream degraded: outer=" + str(outer_running) + ", producer=" + str(producer_running) + ", fresh=" + str(hls_fresh) + ", age=" + str(hls_age) + "s", "ALERT")

    # Measure FPS via HLS segments sequence progression
    now = time.time()
    current_seq = None
    try:
        if os.path.exists(HLS_PLAYLIST):
            with open(HLS_PLAYLIST, "r") as f:
                content = f.read()
            m = re.search(r"#EXT-X-MEDIA-SEQUENCE:(\\d+)", content)
            if m:
                current_seq = int(m.group(1))
    except Exception as e:
        log("[ENCODER HEALTH] Failed to read HLS playlist: " + str(e), "WARN")

    prev_seq = state.get("last_hls_seq")
    prev_time = state.get("last_hls_time")

    if current_seq is not None and prev_seq is not None and prev_time is not None:
        dt = now - prev_time
        dseq = current_seq - prev_seq
        if dt >= 10.0 and dseq >= 0:
            # 2.0s per segment * 30 fps = 60 frames per segment
            fps = (dseq * 60.0) / dt
            if fps < 29.5:
                log("[ENCODER HEALTH] Low FPS detected: " + f"{fps:.2f}" + " fps (< 29.5) over " + f"{dt:.1f}" + "s (" + str(dseq) + " segments, hls_age: " + str(hls_age) + "s)", "ALERT")
            else:
                log("[ENCODER HEALTH] Stream FPS healthy: " + f"{fps:.2f}" + " fps (" + str(dseq) + " segments in " + f"{dt:.1f}" + "s, hls_fresh=" + str(hls_fresh) + ", hls_age=" + str(hls_age) + "s)", "INFO")
            state["last_hls_seq"] = current_seq
            state["last_hls_time"] = now
    elif current_seq is not None:
        log("[ENCODER HEALTH] Baseline initialized at HLS sequence #" + str(current_seq) + " (hls_fresh=" + str(hls_fresh) + ", hls_age=" + str(hls_age) + "s)", "INFO")
        state["last_hls_seq"] = current_seq
        state["last_hls_time"] = now

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

        if cpu >= 80.0:
            current_high_pids.add(pid_str)
            if pid_str not in tracking:
                tracking[pid_str] = now
                log("[WATCH] High CPU detected: PID " + str(pid) + " (" + proc["comm"] + " on CPU " + str(proc["psr"]) + ") at " + str(cpu) + "% CPU. Tracking initiated.", "WARN")
            else:
                duration = now - tracking[pid_str]
                log("[WATCH] PID " + str(pid) + " (" + proc["comm"] + " on CPU " + str(proc["psr"]) + ") sustained high CPU: " + str(cpu) + "% for " + f"{duration:.0f}" + "s", "WARN")
                if duration >= 180.0:
                    log("[ACTION] PID " + str(pid) + " (" + proc["comm"] + " on CPU " + str(proc["psr"]) + ") exceeded 80% CPU for >3m (" + f"{duration:.0f}" + "s). Terminating gracefully (SIGTERM)...", "ALERT")
                    try:
                        os.kill(pid, signal.SIGTERM)
                        time.sleep(3)
                        os.kill(pid, 0)
                        log("[ACTION] PID " + str(pid) + " still running after SIGTERM. Sending force kill (SIGKILL)...", "ALERT")
                        os.kill(pid, signal.SIGKILL)
                    except ProcessLookupError:
                        log("[ACTION] PID " + str(pid) + " terminated successfully.", "INFO")
                    except Exception as e:
                        log("[ACTION] Error terminating PID " + str(pid) + ": " + str(e), "ALERT")

                    tracking.pop(pid_str, None)

    for tracked_pid in list(tracking.keys()):
        if tracked_pid not in current_high_pids:
            log("[WATCH] PID " + str(tracked_pid) + " normalized below 80% CPU or finished. Removed from tracking.", "INFO")
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

const serviceUnit = `[Unit]
Description=GSA TV Process Guardian Watchdog Service
After=network.target docker.service

[Service]
Type=oneshot
ExecStart=/opt/gsa-tv/bin/gsa-process-guardian.sh
StandardOutput=journal
StandardError=journal
`;

const timerUnit = `[Unit]
Description=Run GSA TV Process Guardian every 30 seconds

[Timer]
OnBootSec=15s
OnUnitActiveSec=30s
AccuracySec=1s

[Install]
WantedBy=timers.target
`;

const b64Script = Buffer.from(guardianScript, 'utf8').toString('base64');
const b64Service = Buffer.from(serviceUnit, 'utf8').toString('base64');
const b64Timer = Buffer.from(timerUnit, 'utf8').toString('base64');

const remoteScript = `
set -e
echo "=== 1. DEPLOYING /opt/gsa-tv/bin/gsa-process-guardian.sh ==="
echo "${b64Script}" | base64 -d | sudo tee /opt/gsa-tv/bin/gsa-process-guardian.sh > /dev/null
sudo chmod +x /opt/gsa-tv/bin/gsa-process-guardian.sh
sudo python3 -m py_compile /opt/gsa-tv/bin/gsa-process-guardian.sh

echo "=== 2. DEPLOYING SYSTEMD SERVICE AND TIMER ==="
echo "${b64Service}" | base64 -d | sudo tee /etc/systemd/system/gsa-process-guardian.service > /dev/null
echo "${b64Timer}" | base64 -d | sudo tee /etc/systemd/system/gsa-process-guardian.timer > /dev/null

echo "=== 3. ACTIVATING SYSTEMD TIMER ==="
sudo systemctl daemon-reload
sudo systemctl enable --now gsa-process-guardian.timer

echo "=== 4. CHECKING TIMER AND SERVICE STATUS ==="
sudo systemctl status gsa-process-guardian.timer --no-pager
sudo systemctl list-timers | grep -E "gsa-process-guardian|NEXT"
`;

const res = await runSshScript(remoteScript);
console.log(res.stdout);
if (res.stderr) console.error("STDERR:", res.stderr);
