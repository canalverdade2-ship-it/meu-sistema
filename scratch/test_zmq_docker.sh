docker exec gsa-tv-control-plane python3 -c "
import zmq
ctx = zmq.Context()
s = ctx.socket(zmq.REQ)
s.setsockopt(zmq.LINGER, 0)
s.setsockopt(zmq.SNDTIMEO, 1000)
s.setsockopt(zmq.RCVTIMEO, 1000)
s.connect('tcp://127.0.0.1:5577')
s.send_string('live_badge_box color 0xb91c1c@0.96')
print('ZMQ RESPONSE:', s.recv_string())
"
