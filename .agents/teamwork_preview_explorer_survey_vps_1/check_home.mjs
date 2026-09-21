import { runSshScript } from '../../scratch/ssh2-run.mjs';

async function checkHome() {
  const script = `
echo '=== HOME DIRECTORY ==='
pwd
ls -la ~
ls -la ~/teamwork_projects 2>&1 || true
`;
  const res = await runSshScript(script, 15000);
  console.log(res.stdout);
}

checkHome().catch(console.error);
