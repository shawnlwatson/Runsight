"""Excluded recordings stay out of later imports without filtering other short runs."""
from contextlib import redirect_stdout
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import MagicMock, patch

import load_runs


class RunExclusionTests(unittest.TestCase):
    def test_import_skips_only_explicitly_excluded_ids(self):
        exclusions = json.loads(load_runs.EXCLUSIONS_FILE.read_text())
        excluded_ids = {entry['id'] for entry in exclusions}
        self.assertEqual(len(excluded_ids), len(exclusions))
        with tempfile.TemporaryDirectory() as folder:
            for run_id in excluded_ids:
                (Path(folder) / f'{run_id}-Outdoor Running.fit').touch()
            # Keep a different, very short run: this is not a distance threshold.
            kept = Path(folder) / '2026-01-01-120000-Outdoor Running.fit'
            kept.touch()
            client = MagicMock()
            collection = client.runsight.runs
            collection.bulk_write.return_value.upserted_count = 1
            collection.bulk_write.return_value.matched_count = 0
            with patch.object(load_runs, 'FIT_DIR', folder), \
                 patch.object(load_runs, 'parse_run', return_value={'_id': kept.stem[:17], 'distanceMiles': 0.005}) as parse, \
                 patch.object(load_runs, 'load_dotenv'), \
                 patch.object(load_runs, 'MongoClient', return_value=client), \
                 patch.dict('os.environ', {'MONGODB_URI': 'mongodb://localhost'}), \
                 redirect_stdout(io.StringIO()):
                load_runs.main()
            parse.assert_called_once_with(kept)
            operations = collection.bulk_write.call_args.args[0]
            self.assertEqual(len(operations), 1)
            self.assertEqual(operations[0]._doc['_id'], kept.stem[:17])


if __name__ == '__main__':
    unittest.main()
