// Web-only capture adapter. Recognition's audioTrack overload is not available
// everywhere (notably several Android browsers); never pretend DSP is active.
export async function openBrowserMicrophone({mediaDevices=globalThis.navigator?.mediaDevices}={}){
 if(!mediaDevices?.getUserMedia)throw Error('Browser microphone capture unavailable');
 const requested={echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1};
 const stream=await mediaDevices.getUserMedia({audio:requested,video:false});
 const track=stream.getAudioTracks()[0];
 if(!track){stream.getTracks().forEach(t=>t.stop());throw Error('No live microphone audio track');}
 return {stream,track,requested,actual:track.getSettings?.()||{},
  close(){stream.getTracks().forEach(t=>t.stop());}};
}
export function startBrowserRecognition(recognition,capture,{fallback=true}={}){
 if(capture?.track?.readyState==='live'){
  try{recognition.start(capture.track);return 'processed-track';}
  catch(err){if(!fallback)throw err;}
 }
 if(!fallback)throw Error('Audio track input unsupported');
 recognition.start();
 return 'browser-managed';
}
