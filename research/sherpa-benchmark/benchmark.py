import json, os, subprocess, time, wave
from pathlib import Path
import numpy as np, sherpa_onnx
model=Path('sherpa-onnx-streaming-zipformer-en-20M-2023-02-17')
recognizer=sherpa_onnx.OnlineRecognizer.from_transducer(
 tokens=str(model/'tokens.txt'),
 encoder=str(model/'encoder-epoch-99-avg-1.int8.onnx'),
 decoder=str(model/'decoder-epoch-99-avg-1.onnx'),
 joiner=str(model/'joiner-epoch-99-avg-1.int8.onnx'),
 num_threads=2, decoding_method='greedy_search')
cases={
 'compound':'thirty degrees to the left and run over that tree',
 'halt':'driver halt',
 'turn':'turn right forty degrees',
 'negation':'do not fire',
 'target':'beta fire on the machine gun'}
os.makedirs('artifacts',exist_ok=True)
rows=[]
for key,phrase in cases.items():
 wav=f'artifacts/{key}.wav'
 subprocess.run(['espeak-ng','-v','en-us','-s','150','-w',wav,phrase],check=True)
 with wave.open(wav,'rb') as w:
  rate=w.getframerate();samples=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float32)/32768
 for i in range(5):
  st=recognizer.create_stream();t=time.perf_counter()
  # Send chunks, as streaming runtime would, without artificial real-time sleeps.
  n=int(rate*.10)
  for j in range(0,len(samples),n):
   st.accept_waveform(rate,samples[j:j+n])
   while recognizer.is_ready(st):recognizer.decode_stream(st)
  st.accept_waveform(rate,np.zeros(int(rate*.8),dtype=np.float32))
  st.input_finished()
  while recognizer.is_ready(st):recognizer.decode_stream(st)
  result=recognizer.get_result(st)
  transcript=str(result.text)
  row={'case':key,'trial':i+1,'expected':phrase,'transcript':transcript,'decodeMs':round((time.perf_counter()-t)*1000),'audioMs':round(len(samples)/rate*1000),'engine':'sherpa-onnx-20M-int8','input':'eSpeak full WAV'}
  rows.append(row);print('SHERPA_TRIAL='+json.dumps(row),flush=True)
Path('artifacts/sherpa-results.json').write_text(json.dumps(rows,indent=2))
