import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
    set -e
    echo "================================================="
    echo "TEST 1: Graceful SIGTERM of high-CPU process on Core 3"
    echo "================================================="

    # Create dummy spinning worker
    cat << 'EOF' > /tmp/hog_graceful.py
import time
while True:
    pass
EOF

    nohup taskset -c 3 python3 /tmp/hog_graceful.py >/dev/null 2>&1 &
    TEST_PID1=$!
    echo "Launched runaway test process PID: $TEST_PID1"
    sleep 2

    # Verify it is on Core 3 and running
    ps -o pid,psr,comm,args -p $TEST_PID1

    # Run 1: Initiate tracking
    echo "Running guardian cycle 1 (initiate tracking)..."
    sudo GUARDIAN_CPU_THRESHOLD=50.0 GUARDIAN_TIME_THRESHOLD=2.0 /opt/gsa-tv/bin/gsa-process-guardian.sh

    # Wait 3 seconds to exceed 2.0s threshold
    sleep 3

    # Run 2: Trigger termination
    echo "Running guardian cycle 2 (trigger termination)..."
    sudo GUARDIAN_CPU_THRESHOLD=50.0 GUARDIAN_TIME_THRESHOLD=2.0 /opt/gsa-tv/bin/gsa-process-guardian.sh

    # Verify PID is dead
    if kill -0 $TEST_PID1 2>/dev/null; then
      echo "TEST 1 FAILED: PID $TEST_PID1 is still running!"
      kill -9 $TEST_PID1 2>/dev/null || true
      exit 1
    else
      echo "TEST 1 PASSED: PID $TEST_PID1 terminated gracefully via SIGTERM."
    fi

    echo ""
    echo "================================================="
    echo "TEST 2: Force SIGKILL of stubborn process (SIG_IGN)"
    echo "================================================="

    cat << 'EOF' > /tmp/hog_stubborn.py
import signal
import time
signal.signal(signal.SIGTERM, signal.SIG_IGN)
while True:
    pass
EOF

    nohup taskset -c 3 python3 /tmp/hog_stubborn.py >/dev/null 2>&1 &
    TEST_PID2=$!
    echo "Launched stubborn test process PID: $TEST_PID2"
    sleep 2

    # Verify it is running on Core 3
    ps -o pid,psr,comm,args -p $TEST_PID2

    # Run 1: Initiate tracking
    echo "Running guardian cycle 1..."
    sudo GUARDIAN_CPU_THRESHOLD=50.0 GUARDIAN_TIME_THRESHOLD=2.0 /opt/gsa-tv/bin/gsa-process-guardian.sh

    sleep 3

    # Run 2: Trigger termination (SIGTERM ignored -> SIGKILL)
    echo "Running guardian cycle 2 (should escalate to SIGKILL)..."
    sudo GUARDIAN_CPU_THRESHOLD=50.0 GUARDIAN_TIME_THRESHOLD=2.0 /opt/gsa-tv/bin/gsa-process-guardian.sh

    # Verify PID is dead
    if kill -0 $TEST_PID2 2>/dev/null; then
      echo "TEST 2 FAILED: Stubborn PID $TEST_PID2 is still running!"
      kill -9 $TEST_PID2 2>/dev/null || true
      exit 1
    else
      echo "TEST 2 PASSED: Stubborn PID $TEST_PID2 force-killed via SIGKILL."
    fi

    echo ""
    echo "================================================="
    echo "TEST 3: Live stream integrity & RTMP check"
    echo "================================================="
    status=$(curl -s -H "Authorization: Bearer 222d718911511702a4c813c427fdbab3e70c908d39f5c550c9594f8d3938cd9e" http://127.0.0.1:9210/v1/status)
    echo "Encoder API: $status"
    rtmp=$(ss -tn | grep 1935 || echo "NO_RTMP")
    echo "RTMP Connection: $rtmp"

    # Clean up temp files
    rm -f /tmp/hog_graceful.py /tmp/hog_stubborn.py
    echo "ALL TESTS COMPLETED SUCCESSFULLY!"
  `;
  const res = await runSshScript(script, 90000);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(console.error);
