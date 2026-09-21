#!/usr/bin/env bash
# ==============================================================================
# GSA TV — Autonomous Dependency Installer for Audio Identity Pipeline
# Path: infrastructure/gsa-tv/audio-identity/ensure-dependencies.sh
# Target: Oracle Linux 9.8 (aarch64) & Debian/Ubuntu Linux
# Non-interactive, safe, idempotent dependency provisioner
# ==============================================================================
set -euo pipefail

echo "================================================================================"
echo ">>> [GSA-TV] Audio Identity Pipeline: Dependency Verification & Provisioning"
echo "================================================================================"
echo "Host Architecture: $(uname -m)"
echo "Kernel Version   : $(uname -r)"

SUDO_CMD=""
if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO_CMD="sudo"
  else
    echo "ERROR: Non-root user and sudo not available to install packages." >&2
    exit 1
  fi
fi

# Detect package manager and install base packages
if command -v dnf >/dev/null 2>&1; then
  echo ">>> Package manager detected: dnf (Oracle Linux / RHEL)"
  $SUDO_CMD dnf install -y -q epel-release || true
  $SUDO_CMD dnf install -y -q curl file findutils jq coreutils python3 nodejs || true
elif command -v yum >/dev/null 2>&1; then
  echo ">>> Package manager detected: yum (CentOS / RHEL)"
  $SUDO_CMD yum install -y -q epel-release || true
  $SUDO_CMD yum install -y -q curl file findutils jq coreutils python3 nodejs || true
elif command -v apt-get >/dev/null 2>&1; then
  echo ">>> Package manager detected: apt-get (Debian / Ubuntu)"
  export DEBIAN_FRONTEND=noninteractive
  $SUDO_CMD apt-get update -qq || true
  $SUDO_CMD apt-get install -y -qq ffmpeg curl file findutils jq coreutils python3 nodejs || true
fi

# Ensure ffmpeg and ffprobe are available
if ! command -v ffprobe >/dev/null 2>&1 || ! command -v ffmpeg >/dev/null 2>&1; then
  echo ">>> ffmpeg/ffprobe not found in system PATH. Checking Docker runtime fallback..."
  
  if command -v docker >/dev/null 2>&1; then
    # Look for available gsa-tv control plane or ffplayout image
    DOCKER_IMG=""
    for img in "gsa-tv/control-plane:1.7.2" "gsa-tv/control-plane:latest" "gsa-tv/ffplayout:2.1.0-arm64"; do
      if docker image inspect "$img" >/dev/null 2>&1; then
        DOCKER_IMG="$img"
        break
      fi
    done
    
    if [ -n "$DOCKER_IMG" ]; then
      echo ">>> Found Docker media image ($DOCKER_IMG). Installing /usr/local/bin wrappers..."
      
      $SUDO_CMD bash -c "cat << 'EOF' > /usr/local/bin/ffmpeg
#!/usr/bin/env bash
exec docker run --rm -i -v /opt:/opt -v /home:/home -v /tmp:/tmp -v \"\$PWD\":\"\$PWD\" -w \"\$PWD\" $DOCKER_IMG ffmpeg \"\$@\"
EOF
chmod 0755 /usr/local/bin/ffmpeg"

      $SUDO_CMD bash -c "cat << 'EOF' > /usr/local/bin/ffprobe
#!/usr/bin/env bash
exec docker run --rm -i -v /opt:/opt -v /home:/home -v /tmp:/tmp -v \"\$PWD\":\"\$PWD\" -w \"\$PWD\" $DOCKER_IMG ffprobe \"\$@\"
EOF
chmod 0755 /usr/local/bin/ffprobe"
      
      echo ">>> Docker-backed wrappers installed successfully in /usr/local/bin/"
    fi
  fi
fi

# Final verification of all required commands
REQUIRED_TOOLS=("curl" "file" "find" "jq" "python3" "node" "ffmpeg" "ffprobe")
FAILED_TOOLS=()

for tool in "${REQUIRED_TOOLS[@]}"; do
  if command -v "$tool" >/dev/null 2>&1; then
    echo "  [OK] $tool: $(command -v "$tool")"
  else
    echo "  [FAIL] Missing required tool: $tool"
    FAILED_TOOLS+=("$tool")
  fi
done

if [ ${#FAILED_TOOLS[@]} -gt 0 ]; then
  echo "ERROR: Failed to satisfy required dependencies: ${FAILED_TOOLS[*]}" >&2
  exit 1
fi

echo ">>> [GSA-TV] All dependencies satisfied and verified successfully."
exit 0
