import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';

const deploy = new URL('./deploy-gsa-tv-runtime-1_4.mjs', import.meta.url);
let source = fs.readFileSync(deploy, 'utf8');
const oldText = `sudo chown -R root:root "$base"
sudo chown -R 989:989 /opt/gsa-tv/playlists/1 /opt/gsa-tv/cache/media/1`;
const newText = `sudo chown -R root:root "$base"
sudo chown 989:989 "$base/secrets/ffplayout-admin-password"
sudo chmod 0400 "$base/secrets/ffplayout-admin-password"
sudo chown -R 989:989 /opt/gsa-tv/playlists/1 /opt/gsa-tv/cache/media/1`;
if (!source.includes(oldText)) throw new Error('Trecho de permissões não encontrado no deploy.');
fs.writeFileSync(deploy, source.replace(oldText, newText));
const result = await runSshScript(`set -e
sudo chown 989:989 /opt/gsa-tv/control-plane/secrets/ffplayout-admin-password
sudo chmod 0400 /opt/gsa-tv/control-plane/secrets/ffplayout-admin-password
echo permissions_fixed`);
process.stdout.write(result.stdout);
