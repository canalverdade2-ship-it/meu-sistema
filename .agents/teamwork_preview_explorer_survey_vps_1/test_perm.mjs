import { runSshScript } from '../../scratch/ssh2-run.mjs';

async function testPerms() {
  const script = `
echo '=== TESTING PERMISSIONS ==='
mkdir -p /opt/gsa-tv/cache/media/1/identity/test_perm
ls -ld /opt/gsa-tv/cache/media/1/identity/test_perm
rmdir /opt/gsa-tv/cache/media/1/identity/test_perm
echo 'Permission test passed!'
`;
  const res = await runSshScript(script, 15000);
  console.log(res.stdout);
}

testPerms().catch(console.error);
