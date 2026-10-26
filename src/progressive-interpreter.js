// Progressive ASR hypotheses -> bounded, idempotent commands.
// This module has no Android, ONNX, or game-engine dependency.
const NUMBERS={thirty:30,forty:40,fifty:50,sixty:60,ninety:90};
const TURN=/\b(?:turn|steer|rotate|pivot)\b/;
const NEGATED_FIRE=/\b(?:do not|don't|never|hold|cease|stop)\s+(?:fire|firing)\b/;
const FIRE=/\b(?:fire|shoot)\b/;
const HALT=/\b(?:halt|stop)\b|\b(?:driver|delta)\s+holt\b/;
function splitClauses(input){
 return input.toLowerCase().replace(/[.,!?]/g," ").replace(/\s+/g," ").trim()
 .split(/\s+(?:and|then)\s+(?=(?:run over|crush|turn|driver|delta|beta|gunner|fire|halt)\b)/);
}
export function interpretClause(text,{final=false}={}){
 const s=text.trim().toLowerCase();
 if(!s)return {status:"incomplete",reason:"empty"};
 if(NEGATED_FIRE.test(s))return {status:final?"commit":"prepare",kind:"HOLD_FIRE"};
 if(FIRE.test(s))return {status:final?"clarify":"prepare",kind:"FIRE",reason:"fire_needs_explicit_validated_authorization"};
 if(HALT.test(s))return {status:final?"commit":"prepare",kind:"HALT"};
 if(TURN.test(s)){
  const left=/\bleft\b/.test(s),right=/\bright\b/.test(s);
  if(left&&right)return {status:"reject",kind:"TURN",reason:"conflicting_directions"};
  const direction=left?"left":right?"right":null;
  const tokens=s.match(/\b(\d{1,3}|thirty|forty|fifty|sixty|ninety)\s*(?:degrees?|deg)\b/);
  const angle=tokens?(NUMBERS[tokens[1]]??Number(tokens[1])):null;
  if(!direction||angle===null)return {status:final?"clarify":"prepare",kind:"TURN",reason:!direction?"direction_missing":"angle_missing"};
  if(!Number.isInteger(angle)||angle<1||angle>180)return {status:"reject",kind:"TURN",reason:"invalid_angle"};
  return {status:"commit",kind:"TURN",direction,angle};
 }
 if(/\b(?:run over|crush)\b/.test(s)){
  if(!/\btrees?\b/.test(s))return {status:final?"clarify":"prepare",kind:"CRUSH_TREE",reason:"target_missing"};
  return {status:final?"commit":"prepare",kind:"CRUSH_TREE",target:"tree"};
 }
 return {status:final?"clarify":"prepare",reason:"unrecognized_intent"};
}
function signature(c){return JSON.stringify([c.kind,c.direction??null,c.angle??null,c.target??null]);}
export class ProgressiveInterpreter{
 constructor({stablePartials=2}={}){this.stablePartials=stablePartials;this.sessions=new Map();}
 accept({utteranceId,transcript,isFinal=false}){
  if(!utteranceId||typeof transcript!=="string")throw Error("utteranceId and transcript required");
  if(!this.sessions.has(utteranceId))this.sessions.set(utteranceId,{committed:new Map(),prior:new Map()});
  const state=this.sessions.get(utteranceId),parts=splitClauses(transcript),actions=[],clauses=[];
  for(let i=0;i<parts.length;i++){
   const c=interpretClause(parts[i],{final:isFinal});clauses.push(c);
   const sig=signature(c),previous=state.prior.get(i);
   const count=previous?.signature===sig?previous.count+1:1;
   state.prior.set(i,{signature:sig,count});
   if(c.status!=="commit")continue;
   // Interim hypotheses must repeat before movement is permitted.
   if(!isFinal&&count<this.stablePartials)continue;
   const existing=state.committed.get(i);
   if(existing){
    // Final ASR correction never causes another action at the same clause index.
    if(existing!==sig)clauses[i]={...c,status:"conflict",reason:"already_committed_different_hypothesis"};
    continue;
   }
   state.committed.set(i,sig);
   actions.push({id:utteranceId+":"+i,kind:c.kind,direction:c.direction??null,angle:c.angle??null,target:c.target??null});
  }
  return {actions,clauses};
 }
 reset(utteranceId){this.sessions.delete(utteranceId)}
}
