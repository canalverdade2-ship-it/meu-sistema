import datetime as dt
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('controller',Path(__file__).with_name('night-controller.py'))
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)

class ConfirmationTests(unittest.TestCase):
    def test_actual_control_plane_contract_and_staleness(self):
        now=dt.datetime(2026,9,14,9,0,tzinfo=dt.timezone.utc)
        state={'stream':{'mode':'program','actual':'sending'},'channel':{'signal_state':'sending','last_heartbeat_at':'2026-09-14T08:59:50Z'}}
        self.assertTrue(c.confirmed(state,'program',now))
        self.assertFalse(c.confirmed(state,'standby',now))
        state['channel']['last_heartbeat_at']='2026-09-14T08:55:00Z'
        self.assertFalse(c.confirmed(state,'program',now))

    def test_sending_flag_alone_is_not_confirmation(self):
        self.assertFalse(c.confirmed({'stream':{'actual':'sending','mode':'program'}},'program'))

    def test_incomplete_morning_does_not_send_stream_command(self):
        with patch.object(c.production,'now',return_value=dt.datetime(2026,9,14,6,tzinfo=c.production.TZ)),patch.object(c.production,'compile_ready',side_effect=RuntimeError('incomplete')),patch.object(c.production,'query'),patch.object(c,'transition') as transition,patch('sys.argv',['controller','start']):
            with self.assertRaises(RuntimeError):c.main()
            transition.assert_not_called()

if __name__=='__main__':unittest.main()
