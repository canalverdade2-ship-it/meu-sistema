import { runSshScript } from 'file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gest%C3%A3o-de-servi%C3%A7os%20-%20Copia%20(4)/scratch/ssh2-run.mjs';

/**
 * Step 1: Start `rclone authorize "drive"` in background on VPS,
 * capture the auth URL it prints, then use the headless browser
 * container to open and complete the OAuth flow.
 * 
 * Since the browser container shares the host network (or has access to 127.0.0.1:53682),
 * the OAuth callback should work.
 */
async function main() {
  // Start rclone authorize in background, capture its output for the auth URL
  const script = `
# Kill any existing rclone authorize processes
pkill -f "rclone authorize" 2>/dev/null || true
sleep 1

# Start rclone authorize in background, redirect output to a file
nohup rclone authorize "drive" --auth-no-open-browser > /tmp/rclone-auth-output.txt 2>&1 &
RCLONE_PID=$!
echo "RCLONE_PID=$RCLONE_PID"

# Wait for the auth URL to appear (up to 15 seconds)
for i in $(seq 1 30); do
  sleep 0.5
  if grep -q "http" /tmp/rclone-auth-output.txt 2>/dev/null; then
    echo "=== AUTH URL FOUND ==="
    cat /tmp/rclone-auth-output.txt
    break
  fi
done

# Also check if rclone is still running
if kill -0 $RCLONE_PID 2>/dev/null; then
  echo "rclone authorize is still running (PID=$RCLONE_PID)"
else
  echo "rclone authorize has stopped"
  cat /tmp/rclone-auth-output.txt
fi
`;

  console.log('Starting rclone authorize on VPS...');
  const res = await runSshScript(script, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);

  // Extract the auth URL
  const urlMatch = res.stdout.match(/(https:\/\/accounts\.google\.com\/[^\s]+)/);
  if (urlMatch) {
    console.log('\n=== AUTH URL ===');
    console.log(urlMatch[1]);
  } else {
    console.log('\nCould not extract auth URL from output');
  }
}

main().catch(console.error);
