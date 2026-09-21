import { runSshScript } from './ssh2-run.mjs';

const script = String.raw`set -euo pipefail
sudo docker rm -f gsa-zmq-test >/dev/null 2>&1 || true
sudo docker run -d --rm --name gsa-zmq-test gsa-tv/control-plane:1.6.39 sh -c "printf 'Linha 1\\nLinha 2\\n' >/tmp/body.txt; ffmpeg -hide_banner -loglevel error -re -f lavfi -i color=c=black:s=640x360:r=30 -vf 'drawbox@box=x=10:y=10:w=100:h=80:color=red:t=fill,drawtext@title=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text=ANTIGO:fontcolor=white:fontsize=26:x=30:y=30,drawtext@body=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile=/tmp/body.txt:reload=1:expansion=none:fontcolor=white:fontsize=18:line_spacing=14:x=30:y=80,zmq=bind_address=tcp\\\\://127.0.0.1\\\\:5599' -f null -" >/dev/null
cleanup(){ sudo docker rm -f gsa-zmq-test >/dev/null 2>&1 || true; }
trap cleanup EXIT
sleep 2
for command in \
  'drawbox@box x 25' \
  'drawbox@box width 130' \
  'drawbox@box color #d2a744' \
  'drawtext@title reinit fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text=PRINCIPAIS NOTICIAS:fontcolor=#d2a744:fontsize=26:x=30:y=30' \
  'drawtext@body reinit text=:textfile=/tmp/body.txt:reload=1:expansion=none:fontcolor=white:fontsize=20:line_spacing=16:x=35:y=85' \
  'drawtext@body reinit textfile=/tmp/body.txt:text=:reload=1:expansion=none:fontcolor=white:fontsize=20:line_spacing=16:x=35:y=85'; do
  echo "COMMAND|$command"
  sudo docker exec -e ZMQ_COMMAND="$command" gsa-zmq-test python3 -c "import os,zmq; s=zmq.Context().socket(zmq.REQ); s.setsockopt(zmq.LINGER,0); s.setsockopt(zmq.RCVTIMEO,1500); s.connect('tcp://127.0.0.1:5599'); s.send_string(os.environ['ZMQ_COMMAND']); print(s.recv_string())" || true
done
sudo docker logs gsa-zmq-test 2>&1 | tail -30 || true
`;

const result = await runSshScript(script, 120000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
