import { runSshScript } from '../../scratch/ssh2-run.mjs';

async function testPythonEnv() {
  const script = `
echo '=== PYTHON PACKAGES ==='
python3 -m pip list 2>&1 | head -n 30 || true

echo '=== TEST MUTAGEN / REQUESTS ==='
python3 -c "import requests; print('requests installed')" 2>&1 || echo "requests NOT installed"
python3 -c "import mutagen; print('mutagen installed')" 2>&1 || echo "mutagen NOT installed"

echo '=== NODE / NPM GLOBAL / LOCAL ==='
node -v
npm -v
`;
  const res = await runSshScript(script, 15000);
  console.log(res.stdout);
}

testPythonEnv().catch(console.error);
