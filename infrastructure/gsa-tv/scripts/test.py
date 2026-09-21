import subprocess
import signal
import os
import json

def run_test():
    child = subprocess.Popen(['sleep', '10'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, start_new_session=True)
    try:
        stdout_data, _ = child.communicate(input='hello', timeout=1)
    except BaseException:
        os.killpg(child.pid, signal.SIGTERM)
        try:
            child.wait(timeout=15)
        except subprocess.TimeoutExpired:
            os.killpg(child.pid, signal.SIGKILL)
        raise

run_test()
