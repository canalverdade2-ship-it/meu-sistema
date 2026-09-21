import zmq

ctx = zmq.Context()
s = ctx.socket(zmq.REQ)
s.setsockopt(zmq.LINGER, 0)
s.setsockopt(zmq.SNDTIMEO, 1000)
s.setsockopt(zmq.RCVTIMEO, 1000)
s.connect('tcp://127.0.0.1:5577')

try:
    # Test sending command to live_badge_box
    s.send_string("live_badge_box x 1718")
    reply = s.recv_string()
    print("Reply from 5577:", reply)
except Exception as e:
    print("Error:", e)
finally:
    s.close()
    ctx.term()
