import json, time, wave
from pathlib import Path
import numpy as np, sherpa_onnx
model=Path('sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17')
recognizer=sherpa_onnx.OfflineRecognizer.from_sense_voice(model=str(model/'model.int8.onnx'),tokens=str(model/'tokens.txt'),num_threads=2,language='en',use_itn=True)
rows=[]
for key in ('compound','halt','turn','negation','target'):
 with wave.open(f'artifacts/{key}.wav','rb') as w:
  sr=w.getframerate(); samples=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float32)/32768
 for trial in range(1,6):
  s=recognizer.create_stream();t=time.perf_counter();s.accept_waveform(sr,samples);recognizer.decode_stream(s)
  row={'case':key,'trial':trial,'transcript':s.result.text,'decodeMs':round((time.perf_counter()-t)*1000),'engine':'sensevoice-int8','input':'identical eSpeak WAV'}
  rows.append(row);print('SENSEVOICE_TRIAL='+json.dumps(row),flush=True)
Path('artifacts/sensevoice-results.json').write_text(json.dumps(rows,indent=2))
