"""Integration tests use the workbook, not copies of the generation formulas."""
from collections import Counter
from contextlib import redirect_stdout
from datetime import timedelta
import hashlib
import io
import json
from pathlib import Path
import tempfile
import unittest

import numpy as np
import openpyxl

from health_synthetic.generate_health import BASE, MODEL, PRIOR, MEASURED, generate, sheet_data, number, present


class HealthGeneratorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.tmp.name)
        cls.source = BASE.parent/'raw'/'Health Metrics_v6.xlsx'
        cls.source_hash = hashlib.sha256(cls.source.read_bytes()).hexdigest()
        cls.config = json.loads((BASE/'config.json').read_text())
        with redirect_stdout(io.StringIO()):
            cls.values, cls.origins, cls.report = generate(cls.source,cls.root/'first',cls.config,plots=False)
            generate(cls.source,cls.root/'second',cls.config,plots=False)
        cls.source_wb=openpyxl.load_workbook(cls.source)
        cls.output_wb=openpyxl.load_workbook(cls.root/'first'/'Health Metrics_synthetic.xlsx')

    @classmethod
    def tearDownClass(cls):
        cls.source_wb.close();cls.output_wb.close();cls.tmp.cleanup()

    def test_every_measured_cell_and_format_preserved(self):
        for sheet in self.source_wb:
            _,before,_=sheet_data(sheet)
            _,after,_=sheet_data(self.output_wb[sheet.title])
            output_rows={row[0].value.date():row[0].row for row in self.output_wb[sheet.title].iter_rows(min_row=2) if row[0].value}
            for row in sheet.iter_rows(min_row=2):
                if not row[0].value:continue
                d=row[0].value.date()
                for c in row:
                    if present(c.value):
                        out=self.output_wb[sheet.title].cell(output_rows[d],c.column)
                        self.assertEqual(c.value,out.value,(sheet.title,c.coordinate))
                        self.assertEqual(c.number_format,out.number_format,(sheet.title,c.coordinate))
            for d,r in before.items():
                for c,v in r.items():
                    self.assertEqual(v,after[d][c])
                    self.assertEqual(self.origins[sheet.title].get((d,c),MEASURED),MEASURED)
        self.assertEqual(hashlib.sha256(self.source.read_bytes()).hexdigest(),self.source_hash)
        self.assertEqual(self.report['measured_cells_verified_raw_xml'],3883)

    def test_seed_reproducibility_including_workbook_bytes(self):
        for filename in ('Health Metrics_synthetic.xlsx','variable_validation.csv','temporal_validation.csv','validation.json','provenance.csv'):
            self.assertEqual((self.root/'first'/filename).read_bytes(),(self.root/'second'/filename).read_bytes(),filename)

    def test_full_daily_grids_and_preserved_sparse_schedule(self):
        for name in ('Daily Metrics','Sleep','Womens Health'):
            self.assertEqual(len(self.values[name]),2127)
            self.assertEqual(str(min(self.values[name])),'2020-12-05')
            self.assertEqual(str(max(self.values[name])),'2026-10-01')
        _,original,_=sheet_data(self.source_wb['Daily Metrics'])
        for d,r in original.items():
            self.assertEqual(7 in r,7 in self.values['Daily Metrics'][d])
        additions=[r for d,r in self.values['Daily Metrics'].items() if d not in original]
        vo2=sum(7 in r for r in additions)/len(additions)
        self.assertLess(abs(vo2-101/365),.05)
        self.assertTrue(all(39.67<=r[7]<=50.2 for r in additions if 7 in r))
        _,original_sleep,_=sheet_data(self.source_wb['Sleep'])
        for d,r in original_sleep.items():
            for c in range(14,24):self.assertEqual(c in r,c in self.values['Sleep'][d])
        nights=[r for d,r in self.values['Sleep'].items() if d not in original_sleep]
        self.assertLess(abs(sum(17 in r for r in nights)/len(nights)-7/29),.05)
        self.assertLess(abs(sum(20 in r for r in nights)/len(nights)-28/29),.05)
        self.assertTrue(all(13 not in r for r in nights))

    def test_serialized_sleep_consistency_and_provenance(self):
        _,sleep,_=sheet_data(self.output_wb['Sleep'])
        for d,r in sleep.items():
            self.assertLess(abs(sum(number(r[c]) for c in (8,9,10))-number(r[6]))*3600,.005)
            self.assertLess(abs(number(r[5])-number(r[6])-number(r[7]))*3600,.005)
            self.assertLess(abs(number(r[12])-number(r[6])/number(r[5])),1e-6)
            for low,av,high in ((14,16,15),(18,20,19),(21,23,22)):
                if all(c in r for c in (low,av,high)):
                    self.assertLessEqual(r[low],r[av]);self.assertLessEqual(r[av],r[high])
        categories={row[-1].value for row in self.output_wb['Provenance'].iter_rows(min_row=2)}
        self.assertEqual(categories,{MEASURED,MODEL,PRIOR})
        self.assertEqual(self.report['sleep_consistency']['failures'],[])
        self.assertEqual(len(self.report['sleep_consistency']['clock_exceptions']),1)

    def test_cycles_are_independent_prior_records(self):
        cycles=self.report['cycles']
        for c in cycles:
            self.assertTrue(24<=c['cycle_days']<=35)
            self.assertTrue(3<=c['menstruation_days']<=7)
        self.assertGreater(len({c['cycle_days'] for c in cycles}),3)
        self.assertEqual(set(self.origins['Womens Health'].values()),{PRIOR})

    def test_configurable_fall_asleep_prior_and_seed(self):
        # Exercise model entry points without generating another large workbook.
        from health_synthetic.generate_health import sleep_generate, daily_generate
        headers,original,_=sheet_data(self.source_wb['Sleep'])
        dates=sorted(original)
        config=dict(self.config['sleep']);config['fall_asleep_probability']=1
        values,origins,_=sleep_generate(headers,original,dates,np.random.default_rng(3),config)
        for d,r in values.items():
            self.assertEqual(origins[d,13],PRIOR)
            self.assertLessEqual(number(r[13]),number(r[7]))
        h,o,_=sheet_data(self.source_wb['Daily Metrics'])
        dates=[min(o)-timedelta(days=i) for i in reversed(range(1,61))]+sorted(o)
        a,_,_=daily_generate(h,o,dates,np.random.default_rng(1),self.config['daily'])
        b,_,_=daily_generate(h,o,dates,np.random.default_rng(2),self.config['daily'])
        self.assertNotEqual(a[dates[0]][2],b[dates[0]][2])


if __name__=='__main__':
    unittest.main()
