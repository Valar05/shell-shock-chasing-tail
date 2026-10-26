// Engine-independent progressive order gate. No model/runtime coupling.
// A stable complete movement clause may commit before an utterance is final.
// Firing never commits from interim ASR hypotheses.
const numberWords={thirty:30,forty:40,fifty:50,sixty:60,ninety:90};
function numberOf(text){const m=text.match(/\b(\d{1,3}|thirty|forty|fifty|sixty|ninety)\s*(?:degrees?|deg|°)\b/i);if(!m)return null;return numberWords[m[1].toLowerCase()]??Number(m[1]);}
function segment(text){return text.toLowerCase().replace(/[.,!?]/g," ").replace(/\s+/g," ").trim().split(/\s+and\s+(?=(?:run over|crush|turn|driver|delta|beta|gunner|fire|halt)\b)|\s+then\s+(?=(?:run over|crush|turn|driver|delta|beta|gunner|fire|halt)\b)/);}
export function interpretClause(raw,{final=false}={}){
 const s=raw.trim().toLowerCase();
 if(!s)return {status:"incomplete",reason:"empty"};
 if(/\b(?:do not|don't|never|hold|cease|stop)\s+(?:fire|firing)\b/.test(s))return {status:final?"commit":"prepare",kind:"HOLD_FIRE",safe:true};
 if(/\b(?:fire|shoot)\b/.test(s))return {status:final?"clarify":"prepare",kind:"FIRE",reason:"explicit_fire_authorization_requires_final_validation"};
 if(/\b(?:halt|stop)\b/.test(s)||/\b(?:driver|delta)\s+holt\b/.test(s))return {status:final?"commit":"prepare",kind:"HALT",safe:true};
 if(/\b(?:turn|steer|rotate|pivot)\b/.test(s)){
  const direction=/\bleft\b/.test(s)?"left":/\bright\b/.test(s)?"right":null;
  const angle=numberOf(s);
  if(!direction||angle===null)return {status:final?"clarify":"prepare",kind:"TURN",reason:!direction?"direction_missing":"angle_missing"};
  if(!Number.isInteger(angle)||angle<1||angle>180)return {status:"reject",kind:"TURN",reason:"invalid_angle"};
  return {status:"commit",kind:"TURN",direction,angle,safe:true};
 }
 if(/\b(?:run over|crush)\b/.test(s)){
   if(!/\btrees?\b/.test(s))return {status:final?"clarify":"prepare",kind:"CRUSH_TREE",reason:"target_missing"};
   return {status:final?"commit":"prepare",kind:"CRUSH_TREE",target:"tree",safe:true};
 }
 return {status:final?"clarify":"prepare",reason:"unrecognized_intent"};
}
export class ProgressiveInterpreter {
 constructor(){this.turnId=null;this.done=new Set();}
 accept({utteranceId,transcript,isFinal=false}){
  if(!utteranceId||typeof transcript!=="string")throw Error("utteranceId and transcript required");
  const fragments=segment(transcript);const actions=[];
  for(let i=0;i<fragments.length;i++){
   const fragment=fragments[i];const analysis=interpretClause(fragment,{final:isFinal});
   // A trailing clause may still be extended. Never commit an interim fire or target order.
   if(analysis.status!=="commit")continue;
   const key=utteranceId+":"+i;
   if(this.done.has(key))continue;
   this.done.add(key);
   actions.push({id:key,kind:analysis.kind,direction:analysis.direction??null,angle:analysis.angle??null,target:analysis.target??null});
  }
  return {actions,clauses:fragments.map(f=>interpretClause(f,{final:isFinal}))};
 }
 reset(utteranceId){this.done.forEach(key=>{if(key.startsWith(utteranceId+":"))this.done.delete(key)})}
}
