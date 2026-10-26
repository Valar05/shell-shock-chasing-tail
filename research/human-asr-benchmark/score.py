#!/usr/bin/env python3
"""Score ASR results against human voice reference; no ASR dependencies."""
import json,sys,re,statistics
from pathlib import Path
root=Path(__file__).resolve().parent
cases={x['id']:x for x in json.loads((root/'manifest.json').read_text())['cases']}
nums={'thirty':'30','forty':'40'}
def words(s):
 w=re.findall(r"[a-z]+|\d+",s.lower())
 return [nums.get(x,x) for x in w]
def slots(s):
 w=words(s)
 return {'direction':next((x for x in ('left','right') if x in w),None), 'degrees':next((x for x in ('30','40') if x in w),None), 'negation':('not' in w), 'target_tree':('tree' in w), 'halt':('halt' in w)}
for name in sys.argv[1:]:
 doc=json.loads(Path(name).read_text());data=doc['rows'] if isinstance(doc,dict) else doc
 print('\n',name)
 for row in data:
  expected=cases[row['case']]['expected'];heard=row.get('transcript','')
  want=slots(expected);got=slots(heard)
  equal=all(got[k]==v for k,v in want.items() if v is not None and v is not False)
  # For negations, false is a meaningful requirement too.
  if got['negation']!=want['negation']:equal=False
  print(f"{row['case']}: slot_pass={equal} | expected={expected!r} | heard={heard!r} | decode_ms={row.get('decode_ms')}")
