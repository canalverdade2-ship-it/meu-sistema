import { runSshScript } from './ssh2-run.mjs';

const cmd = `
docker exec gsa-tv-ffplayout sqlite3 /state/ffplayout.db ".tables"
docker exec gsa-tv-ffplayout sqlite3 /state/ffplayout.db ".backup '/backups/ffplayout-test.db'"
ls -la /opt/gsa-tv/backups/ffplayout/ffplayout-test.db
rm -f /opt/gsa-tv/backups/ffplayout/ffplayout-test.db
echo "Sqlite .backup works!"
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
