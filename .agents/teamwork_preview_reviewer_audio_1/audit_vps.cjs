const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    for c in news viral faith lifestyle sfx; do
      echo -n "$c: "
      find /opt/gsa-tv/cache/media/1/identity/audio/$c -type f | wc -l
    done
    echo -n "Total disk usage: "
    du -sh /opt/gsa-tv/cache/media/1/identity/audio
    echo -n "Smallest 3 audio files (bytes): "
    find /opt/gsa-tv/cache/media/1/identity/audio -type f -name '*.wav' -o -name '*.mp3' | xargs stat -c%s | sort -n | head -n 3 | tr '\n' ' '
    echo ""
    echo "Testing ffprobe on one sample from each category:"
    for c in news viral faith lifestyle sfx; do
      sample=$(find /opt/gsa-tv/cache/media/1/identity/audio/$c -type f | head -n 1)
      echo -n "$c ($(basename "$sample")): "
      ffprobe -v error -show_entries format=duration,format_name -of default=noprint_wrappers=1 "$sample" | tr '\n' ' '
      echo ""
    done
  `;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '147.15.43.141',
  port: 22,
  username: 'opc',
  privateKey: fs.readFileSync('C:/Users/Adriano Farias/Downloads/CLOUD/ssh-key-2026-07-30.key')
});
