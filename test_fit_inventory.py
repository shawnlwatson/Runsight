"""Small binary FIT fixtures test coverage counts and failure isolation."""
import struct
import tempfile
import unittest
from pathlib import Path

import fitdecode
import fit_inventory as inventory


def definition(local, global_number, fields):
    return bytes([0x40 | local, 0, 0]) + struct.pack('<H', global_number) + bytes([len(fields)]) + b''.join(bytes(f) for f in fields)


def fixture(null_hr=False):
    body = definition(0, 18, [(2, 4, 0x86)])  # session.start_time
    body += b'\x00' + struct.pack('<I', 1_000_000_000)
    body += definition(1, 20, [(253, 4, 0x86), (3, 1, 2), (13, 1, 1)])
    for second in range(3):  # repeated samples must count as one workout
        body += b'\x01' + struct.pack('<IBb', 1_000_000_000 + second, 255 if null_hr else 140, 0)
    body += definition(2, 19, [(15, 1, 2)])  # lap.avg_heart_rate
    body += b'\x02\x8c'
    header = struct.pack('<BBHI4s', 14, 0x20, 100, len(body), b'.FIT')
    header += struct.pack('<H', fitdecode.utils.compute_crc(header))
    data = header + body
    return data + struct.pack('<H', fitdecode.utils.compute_crc(data))


class InventoryTest(unittest.TestCase):
    def test_binary_coverage_crc_null_and_levels(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            hidden = root / '.hidden'
            hidden.mkdir()
            (hidden / 'first.FIT').write_bytes(fixture())
            (root / 'second.fit').write_bytes(fixture(null_hr=True))
            corrupt = bytearray(fixture())
            corrupt[-1] ^= 1
            (root / 'bad.fit').write_bytes(corrupt)
            (root / 'sidecar.fit:Zone.Identifier').write_text('Not a FIT file')
            report = inventory.run(root, root / 'output')
            self.assertEqual(report['summary']['total_files'], 3)
            self.assertEqual(report['summary']['valid_files'], 2)
            self.assertEqual(report['summary']['failed_files'], 1)
            self.assertIn('FitCRCError', next(r for r in report['files'] if r['status'] == 'failed')['error'])
            hr = next(r for r in report['fields'] if r['message_type'] == 'record' and r['field_name'] == 'heart_rate')
            self.assertEqual(hr['occurrences'], 6)
            self.assertEqual(hr['workouts_present'], 2)
            self.assertEqual(hr['workouts_with_values'], 1)
            metrics = {(r['metric'], r['level']): r for r in report['metric_coverage']}
            self.assertEqual(metrics['heart_rate', 'any_level']['workouts_with_values'], 2)
            self.assertEqual(metrics['heart_rate', 'lap']['workouts_with_values'], 2)
            self.assertEqual(metrics['heart_rate', 'timestamped_record']['workouts_with_values'], 1)
            self.assertEqual(metrics['temperature', 'timestamped_record']['workouts_with_values'], 2)
            self.assertEqual(metrics['humidity', 'any_level']['workouts_with_values'], 0)
            self.assertTrue(all(r['date_source'] == 'session.start_time' for r in report['files'] if r['status'] == 'valid'))
            self.assertTrue((root / 'output' / 'inventory.json').exists())

    def test_value_policy(self):
        for value in (0, False, (None, 0), 'clear'):
            self.assertTrue(inventory.usable(value))
        for value in (None, (), (None, None), float('nan'), float('inf'), ''):
            self.assertFalse(inventory.usable(value))


if __name__ == '__main__':
    unittest.main()
