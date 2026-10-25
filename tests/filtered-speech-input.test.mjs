import test from 'node:test';
import assert from 'node:assert/strict';
import {createFilteredSpeechInput} from '../src/filtered-speech-input.js';
function fake(){
 const calls=[],track={kind:'audio',readyState:'live',stopped:false,getSettings(){return {echoCancellation:true,noiseSuppression:true,autoGainControl:true}},stop(){this.stopped=true}};
 const node=()=>({connect(target){calls.push('connect');return target},disconnect(){calls.push('disconnect')}});
 const ctx={createMediaStreamSource(){return node()},createBiquadFilter(){return {...node(),frequency:{value:0},Q:{value:0}}},createDynamicsCompressor(){return {...node(),threshold:{value:0},knee:{value:0},ratio:{value:0},attack:{value:0},release:{value:0}}},createMediaStreamDestination(){return {stream:{getAudioTracks:()=>[{kind:'audio',readyState:'live'}]}}},async resume(){},async close(){calls.push('close')}};
 const mediaDevices={async getUserMedia(request){calls.push(request);return {getAudioTracks:()=>[track],getTracks:()=>[track]}}};
 return {mediaDevices,AudioContextClass:class{constructor(){return ctx}},calls,track};
}
test('browser filtering requests microphone AEC NS AGC and delivers audio track',async()=>{
 const deps=fake(),input=createFilteredSpeechInput(deps);
 const out=await input.prepare();
 assert.equal(out.track.kind,'audio');
 assert.equal(input.settings.echoCancellation,true);
 const request=deps.calls[0];assert.equal(request.audio.echoCancellation,true);assert.equal(request.audio.noiseSuppression,true);
 assert.equal(request.audio.autoGainControl,true);
 await input.close();assert.equal(deps.track.stopped,true);assert.ok(deps.calls.includes('close'));
});
test('browser filtering returns explicit unsupported rather than pretending processing',async()=>{
 const input=createFilteredSpeechInput({mediaDevices:null,AudioContextClass:null});
 assert.equal(input.supported(),false);
 await assert.rejects(input.prepare(),/unsupported/);
});
