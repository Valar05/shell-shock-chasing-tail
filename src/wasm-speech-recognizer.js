// Browser-only Vosk WASM recognition. Audio is already conditioned by
// filtered-speech-input.js; this adapter never accesses the default microphone.
const SCRIPT='https://cdn.jsdelivr.net/npm/vosk-browser@0.0.5/dist/vosk.js';
const MODEL='https://fiddle-app.github.io/voice-models/vosk-model-small-en-us-0.15.tar.gz';
// Domain vocabulary steers a compact acoustic model toward likely tank orders.
// [unk] keeps unusual/free-form commander speech possible.
const GRAMMAR=JSON.stringify([
 '[unk]','driver','gunner','loader','silver','delta','beta','gamma',
 'advance','halt','stop','reverse','turn left','turn right','fire',
 'load ap','load he','reload','acquire target','report','status report',
 'run over that tree','driver run over that tree','run over the tree',
 'knock down that tree','crush that tree','flatten that tree',
 'go forward','drive forward','hold fire','enemy ahead','enemy to the right',
 'gunner fire','loader load ap','driver advance','driver halt',
 'what do you see','where is the enemy','turn ten degrees left',
 'turn twenty degrees right','run over that tree over there'
]);
let loader=null;
function loadVosk(){
 if(globalThis.Vosk?.createModel)return Promise.resolve(globalThis.Vosk);
 if(loader)return loader;
 loader=new Promise((resolve,reject)=>{
  const el=document.createElement('script');el.src=SCRIPT;el.async=true;
  el.onload=()=>globalThis.Vosk?.createModel?resolve(globalThis.Vosk):reject(Error('Vosk library missing after load'));
  el.onerror=()=>reject(Error('Unable to fetch Vosk browser engine'));
  document.head.append(el);
 }).catch(e=>{loader=null;throw e});
 return loader;
}
export function createBrowserWasmRecognizer({input,onPartial=()=>{},onFinal=()=>{},onStatus=()=>{}}){
 let context=null,recognizer=null,model=null,processor=null,source=null,sink=null,running=false;
 async function start(){
  if(running)return;
  onStatus('Loading browser speech model (first use ~40 MB)…');
  const Vosk=await loadVosk();
  model=await Vosk.createModel(MODEL);
  const {track}=await input.prepare();
  if(!track||track.readyState==='ended')throw Error('Filtered microphone track unavailable');
  const A=globalThis.AudioContext||globalThis.webkitAudioContext;
  if(!A)throw Error('Web Audio not available');
  context=new A();
  // Read the already filtered track, NOT the unprocessed microphone.
  source=context.createMediaStreamSource(new MediaStream([track]));
  recognizer=new model.KaldiRecognizer(context.sampleRate,GRAMMAR);
  recognizer.on('partialresult',event=>onPartial(event.result?.partial||''));
  recognizer.on('result',event=>{const transcript=event.result?.text?.trim();if(transcript)onFinal(transcript);});
  processor=context.createScriptProcessor(4096,1,1);
  processor.onaudioprocess=event=>{if(running)recognizer.acceptWaveform(event.inputBuffer);};
  // ScriptProcessor requires a connected output in some browsers.
  // A zero-gain sink ensures no microphone monitor sound reaches speakers.
  sink=context.createGain();sink.gain.value=0;
  source.connect(processor);processor.connect(sink);sink.connect(context.destination);
  await context.resume();running=true;onStatus('WASM voice recognition listening · filtered microphone');
 }
 async function stop(){
  running=false;processor?.disconnect();source?.disconnect();sink?.disconnect();
  processor=null;source=null;sink=null;
  await context?.close();context=null;
  recognizer?.remove?.();recognizer=null;
  model?.terminate?.();model=null;
  await input.close();onStatus('Microphone OFF');
 }
 return {start,stop,get running(){return running}};
}
