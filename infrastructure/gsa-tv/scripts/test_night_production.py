import datetime as dt
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('night',Path(__file__).with_name('night-production.py'))
night=importlib.util.module_from_spec(spec)
spec.loader.exec_module(night)


class ProductionSafety(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.root=Path(self.temp.name)
        self.media=self.root/'media'
        self.media.mkdir()
        self.file=self.media/'master.mp4'
        self.file.write_bytes(b'test')
        self.block={'id':'b1','program_id':'p1','name':'Programa','media_item_id':None,'planned_start_offset_s':21600,'planned_duration_s':1800}
        self.record={'id':'m1','state':'ready','approval_state':'approved','rights_ok':True,'rights_expires_at':None,'drive_path':'master.mp4','duration_s':1800}
        self.patcher=patch.object(night,'MEDIA',self.media)
        self.patcher.start()

    def tearDown(self):
        self.patcher.stop()
        self.temp.cleanup()

    def test_paths_accept_both_storage_formats_and_reject_escape(self):
        self.assertEqual(night.media_path('/media/1/master.mp4'),self.file)
        self.assertEqual(night.media_path('master.mp4'),self.file)
        for path in ['../../secret','/etc/passwd',None]:
            with self.assertRaises(ValueError): night.media_path(path)

    def test_duration_must_fill_slot(self):
        for value,expected in [(1800,None),(1800.03,None),(20,'underfilled'),(3444,'overlong')]:
            with patch.object(night,'probe',return_value=value):
                self.assertEqual(night.media_issue(self.record,self.block,'2026-09-14'),expected)

    def test_rights_cover_end_not_only_current_time(self):
        self.record['rights_expires_at']='2026-09-14T09:15:00Z'
        self.assertEqual(night.media_issue(self.record,self.block,'2026-09-14'),'rights_expired_before_end')

    def test_pending_candidate_never_links(self):
        self.record['approval_state']='pending'
        with patch.object(night,'query',return_value=[self.record]) as query:
            night.link_eligible('2026-09-14','v1',[self.block])
            self.assertEqual(query.call_count,1)
            self.assertIsNone(self.block['media_item_id'])

    def test_incomplete_grade_never_queues_compilation(self):
        with patch.object(night,'published',return_value=('v1',[])),patch.object(night,'report',return_value={'state':'incomplete'}),patch.object(night,'query') as query:
            with self.assertRaises(RuntimeError): night.compile_ready('2026-09-14')
            query.assert_not_called()

    def test_existing_operator_link_is_preserved(self):
        self.block['media_item_id']='operator-choice'
        with patch.object(night,'query') as query:
            night.link_eligible('2026-09-14','v1',[self.block])
            query.assert_not_called()

    def test_checkpoint_rejects_changed_master(self):
        manifest=self.root/'manifest.json';manifest.write_text('{}')
        qc={'state':'validated','broadcast_date':'2026-09-14','manifest_sha256':night.sha256(manifest),'sha256':night.sha256(self.file)}
        self.file.with_suffix('.qc.json').write_text(json.dumps(qc))
        with patch.object(night,'probe',return_value=1800):
            self.assertTrue(night.reusable_master(self.file,manifest,'2026-09-14',1800))
            self.file.write_bytes(b'changed')
            self.assertFalse(night.reusable_master(self.file,manifest,'2026-09-14',1800))

    def test_nan_probe_rejected(self):
        class Result: stdout='{"format":{"duration":"NaN"}}'
        with patch.object(night.subprocess,'run',return_value=Result()):
            with self.assertRaises(ValueError): night.probe(self.file)


if __name__=='__main__': unittest.main()
