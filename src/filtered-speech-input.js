// Browser input conditioning: mic -> AEC/NS/AGC capture -> HPF -> compressor
// -> MediaStreamDestination -> SpeechRecognition.start(track), where supported.
// Browser limitations: Chrome Android may not accept the track argument.
export function createFilteredSpeechInput({mediaDevices=globalThis.navigator?.mediaDevices,AudioContextClass=globalThis.AudioContext||globalThis.webkitAudioContext}={}){
 let stream=null,context=null,source=null,filter=null,compressor=null,destination=null;
 let state='idle',settings=null;
 const supported=()=>Boolean(mediaDevices?.getUserMedia&&AudioContextClass);
 async function prepare(){
  if(stream?.getAudioTracks()[0]?.readyState==='live')return {track:destination.stream.getAudioTracks()[0],settings};
  if(!supported())throw Error('Filtered capture unsupported in this browser');
  stream=await mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1},video:false});
  const mic=stream.getAudioTracks()[0];settings=mic.getSettings?.()||{};
  context=new AudioContextClass();
  source=context.createMediaStreamSource(stream);
  filter=context.createBiquadFilter();filter.type='highpass';filter.frequency.value=110;filter.Q.value=.707;
  compressor=context.createDynamicsCompressor();
  compressor.threshold.value=-28;compressor.knee.value=20;compressor.ratio.value=3;compressor.attack.value=.004;compressor.release.value=.18;
  destination=context.createMediaStreamDestination();
  source.connect(filter);filter.connect(compressor);compressor.connect(destination);
  // Never connect to speakers: avoids monitor feedback.
  await context.resume?.();
  state='ready';
  return {track:destination.stream.getAudioTracks()[0],settings};
 }
 async function close(){
  state='idle';stream?.getTracks().forEach(t=>t.stop());stream=null;
  for(const n of [source,filter,compressor])n?.disconnect?.();
  await context?.close?.();context=null;destination=null;source=null;filter=null;compressor=null;
 }
 return {prepare,close,supported,get state(){return state},get settings(){return settings}};
}
