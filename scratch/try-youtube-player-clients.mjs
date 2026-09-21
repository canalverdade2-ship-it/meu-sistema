import { runSshScript } from './ssh2-run.mjs';
const result=await runSshScript(`set +e
for client_name in web_safari mweb android_vr tv_embedded; do
 echo "--- client=$client_name ---"
 yt-dlp --no-warnings --extractor-args "youtube:player_client=$client_name" --skip-download --print '%(id)s|%(title)s|%(is_live)s|%(live_status)s|%(manifest_url)s' 'https://www.youtube.com/watch?v=soeRG2L70ys' 2>&1 | tail -n 5
done`,90000);
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
