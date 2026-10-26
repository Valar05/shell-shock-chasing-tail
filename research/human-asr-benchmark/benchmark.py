#!/usr/bin/env python3
"""Reproducible HUMAN voice fixture benchmark. Requires numpy and sherpa-onnx.

Run: python benchmark.py --model-dir /path/to/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17 --engine sensevoice
  or python benchmark.py --model-dir /path/to/sherpa-onnx-streaming-zipformer-en-20M-2023-02-17 --engine zipformer
Other recognizers can write same schema to results.json; evaluate via score.py.
"""
import argparse,json,time,wave,re
from pathlib import Path
import numpy as np
import sherpa_onnx
p=argparse.ArgumentParser();p.add_argument('--model-dir',required=True);p.add_argument('--engine',choices=('sensevoice','zipformer'),required=True);p.add_argument('--repeats',type=int,default=3);p.add_argument('--output',default='results.json');a=p.parse_args()
root=Path(__file__).resolve().parent;model=Path(a.model_dir).resolve()
if a.engine=='sensevoice':
 rec=sherpa_onnx.OfflineRecognizer.from_sense_voice(model=str(model/'model.int8.onnx'),tokens=str(model/'tokens.txt'),num_threads=2,language='en',use_itn=True)
else:
 rec=sherpa_onnx.OnlineRecognizer.from_transducer(tokens=str(model/'tokens.txt'),encoder=str(model/'encoder-epoch-99-avg-1.int8.onnx'),decoder=str(model/'decoder-epoch-99-avg-1.onnx'),joiner=str(model/'joiner-epoch-99-avg-1.int8.onnx'),num_threads=2,decoding_method='greedy_search')
rows=[]
for case in json.loads((root/'manifest.json').read_text())['cases']:
 with wave.open(str(root/case['file'])) as w:
  assert w.getnchannels()==1 and w.getframerate()==16000 and w.getsampwidth()==2
  pcm=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float32)/32768
 for trial in range(1,a.repeats+1):
  s=rec.create_stream();start=time.perf_counter()
  if a.engine=='sensevoice':
   s.accept_waveform(16000,pcm);rec.decode_stream(s);res=s.result;text=res.text if hasattr(res,'text') else str(res)
  else:
   for i in range(0,len(pcm),1600):
    s.accept_waveform(16000,pcm[i:i+1600]);
    while rec.is_ready(s):rec.decode_stream(s)
   s.accept_waveform(16000,np.zeros(12800,dtype=np.float32));s.input_finished()
   while rec.is_ready(s):rec.decode_stream(s)
   res=rec.get_result(s);text=res.text if hasattr(res,'text') else str(res)
  row=dict(case=case['id'],expected=case['expected'],engine=a.engine,trial=trial,transcript=text.strip(),decode_ms=round((time.perf_counter()-start)*1000),input_sha256=case['sha256'],source='human-recorded PCM 16k')
  print(json.dumps(row),flush=True);rows.append(row)
Path(a.output).write_text(json.dumps(dict(schema='shellshock.human-asr-results.v1',rows=rows),indent=2))
