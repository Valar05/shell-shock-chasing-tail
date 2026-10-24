// Shell Shock command compiler.
// Architecture adapted from Valar05/truth-first-rpg v6.3 intent graphs.
// Strict routing and radio-silence semantics reviewed against
// Valar05/tanks-for-the-memories/src/command-compiler.ts (master).
// The two reference games have different mechanics; no story/state is imported.

const ACTORS={
  driver:"delta",delta:"delta",chauffeur:"delta",
  gunner:"beta",beta:"beta",
  loader:"gamma",gamma:"gamma",
  silver:"silver",radio:"silver",operator:"silver",observer:"silver",
  alpha:"alpha",commander:"alpha"
};
const ROLES={
  ADVANCE:"delta",REVERSE:"delta",HALT:"delta",TURN:"delta",
  TRAVERSE:"beta",ACQUIRE:"beta",FIRE:"beta",HOLD_FIRE:"beta",
  LOAD:"gamma",REPORT:"silver",SPOT:"beta",RESTART:"alpha"
};
const SUBJECTS="driver|delta|chauffeur|gunner|beta|loader|gamma|silver|radio|operator|observer|alpha|commander";
const subjectRx=new RegExp("\\b("+SUBJECTS+")\\b","gi");
const ACTION_START=/\b(?:advance|proceed|drive|move|push|go|reverse|back(?:ward|wards)?|halt|stop|brake|turn|steer|rotate|pivot|traverse|slew|load|reload|chamber|select|fire|shoot|acquire|track|engage|report|status|sitrep|scan|look|hold|cease|restart|retry|spot|designate)\b/gi;
const NUMBER_WORDS={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90,hundred:100};
const vocabulary=[
  ["RESTART",/\b(restart|retry|new game|start over)\b/],
  ["SPOT",/\b(spot|designate|contact at|enemy at|target at|bearing|azimuth|o'?clock)\b/],
  ["HOLD_FIRE",/\b(hold fire|cease fire|don't fire|do not fire)\b/],
  ["TRAVERSE",/\b(traverse|slew)\b/],
  ["HALT",/\b(halt|stop|brake|hold position)\b/],
  ["REVERSE",/\b(reverse|back(?:ward|wards)?|back up|pull back)\b/],
  ["TURN",/\b(turn|steer|rotate|pivot|swing)\b/],
  ["LOAD",/\b(load|reload|chamber|select|armor.piercing|armour.piercing|high.explosive)\b/],
  ["FIRE",/\b(fire|shoot|send a round)\b/],
  ["ACQUIRE",/\b(acquire|track|engage|lay on|lock on)\b/],
  ["REPORT",/\b(report|status|sitrep|scan|look|what do you see|what can you see)\b/],
  ["ADVANCE",/\b(advance|proceed|drive|move|push|go forward|go ahead|take us|bring us)\b/]
];

export function normalizeSpeech(input){
  return String(input??"").toLowerCase()
    .replace(/[’‘]/g,"'").replace(/[“”]/g,'"')
    .replace(/(\d)\s*°/g,"$1 degrees")
    .replace(/\b(?:uh+|um+|please|kindly)\b/g," ")
    .replace(/\b(?:go ahead and|would you|could you|can you)\b/g," ")
    .replace(/\b(\w+)(?:\s+\1\b)+/g,"$1")
    .replace(/\s+/g," ").trim();
}
function numeric(s){
  const m=s.match(/\b(\d+(?:\.\d+)?)\b/);
  if(m)return Number(m[1]);
  const tokens=s.replace(/-/g," ").split(/\s+/);
  const found=tokens.map((w,i)=>NUMBER_WORDS[w]===undefined?null:{n:NUMBER_WORDS[w],i}).filter(Boolean);
  if(!found.length)return null;
  let total=0,active=0,last=found[0].i-1;
  for(const {n,i} of found){
    if(i-last>2&&total>0)break;
    if(n===100)active=Math.max(1,active)*100;
    else if(n>=20&&n%10===0){if(active>=100){total+=active;active=0;}active+=n;}
    else active+=n;
    last=i;
  }
  return total+active;
}
export function parseAmount(raw,kind){
  const segment=raw.match(kind==="distance"?/\b((?:\d+(?:\.\d+)?|[\w -]+))\s*(?:meters?|metres?|yards?)\b/:
    /\b((?:\d+(?:\.\d+)?|[\w -]+))\s*(?:degrees?|deg)\b/);
  if(segment)return numeric(segment[1]);
  // Bare number after a direction is an angle, not a tank movement distance.
  if(kind==="angle")return numeric(raw);
  return null;
}
function splitSections(text){
  // Preserve connectors as graph edges. "and" between two verbs stays inside
  // a concurrent packet; "then" creates an explicit dependency.
  const connectors=/(\s*[;.!?]\s*|\s+and then\s+|\s+then\s+|\s+after that\s+|\s+while\s+|\s+meanwhile\s+|\s+and\s+(?=(?:driver|delta|chauffeur|gunner|beta|loader|gamma|silver|radio|observer)\b))/gi;
  const parts=text.split(connectors),out=[];
  let relation="FIRST";
  for(const part of parts){
    if(!part?.trim())continue;
    if(/^\s*(?:[;.!?]+|and then|then|after that|while|meanwhile|and)\s*$/i.test(part)){
      relation=/then|after that|[.!?]/i.test(part)?"AFTER": "CONCURRENT";
      continue;
    }
    out.push({text:part.trim(),relation});relation="CONCURRENT";
  }
  return out;
}
function splitActions(section){
  const matches=[...section.matchAll(ACTION_START)];
  const starts=[];
  for(const m of matches){
    // "go forward" should be one action; "reports locked" isn't an order.
    if(starts.length&&/\b(?:go|move|drive|push)\s+$/.test(section.slice(starts.at(-1),m.index)))continue;
    starts.push(m.index);
  }
  if(starts.length<2)return [section];
  const out=[];
  for(let i=0;i<starts.length;i++){
    const text=section.slice(i===0?0:starts[i],i+1<starts.length?starts[i+1]:section.length).trim();
    if(text)out.push(text);
  }
  return out;
}
function classify(raw){
  const found=vocabulary.filter(([,rx])=>rx.test(raw)).map(([action])=>action);
  if(!found.length){
    if(/\b(left|right)\b/.test(raw))return "TURN";
    return null;
  }
  // A turn may be implicit in the phrase "advance left"; it is split
  // into movement plus turn upstream when another action is explicit.
  return found[0];
}
function conditionFrom(raw){
  const m=raw.match(/\b(when|once|until|if)\s+(.+)$/);
  if(!m)return {main:raw,condition:null,error:null};
  const main=raw.slice(0,m.index).trim(),tail=m[2].trim();
  if(/\b(?:gunner|beta)\b.*\b(?:locked|laid|on target|ready)\b/.test(tail))
    return {main,condition:{type:"GUNNER_LOCKED",mode:m[1].toUpperCase()},error:null};
  if(/\b(?:loader|gamma)\b.*\b(?:ready|loaded|finished)\b|\b(?:gun|round|shell)\s+(?:is\s+)?loaded\b/.test(tail))
    return {main,condition:{type:"ROUND_LOADED",mode:m[1].toUpperCase()},error:null};
  if(/\b(?:contact|enemy|panzer)\b.*\b(?:spotted|seen|confirmed)\b/.test(tail))
    return {main,condition:{type:"CONTACT_CONFIRMED",mode:m[1].toUpperCase()},error:null};
  return {main,error:{code:"UNKNOWN_CONDITION",detail:tail},condition:null};
}
function directionOf(raw){
  const direct=raw.match(/\b(left|right|port|starboard)\b/);
  return direct?({port:"left",starboard:"right"}[direct[1]]||direct[1]):null;
}
function bearingOf(raw){
  const clock=raw.match(/\b(1[0-2]|[1-9])\s*(?:o\s*'?\s*clock|oclock)\b/);
  if(clock)return {type:"CLOCK",value:Number(clock[1])};
  const degrees=raw.match(/\b(?:bearing|azimuth|heading)\s*(\d{1,3})\s*(?:degrees?|deg)?\b/);
  if(degrees)return {type:"ABSOLUTE",value:Number(degrees[1])};
  const relative=raw.match(/\b(ahead|front|forward|left|right|port|starboard|behind|rear)\b/);
  if(relative)return {type:"RELATIVE",value:directionOf(relative[0])||relative[1]};
  return null;
}
function ammoOf(raw){
  if(/\b(?:armor|armour)[ -]?piercing\b|\bap\b/.test(raw))return "AP";
  if(/\bhigh[ -]?explosive\b|\bhe\b/.test(raw))return "HE";
  if(/\bsmoke\b/.test(raw))return "SMOKE";
  return null;
}

export function parseTransmission(input,prior={}){
 const normalized=normalizeSpeech(input),frames=[],errors=[];
 let focusActor=prior.focusActor||null;
 if(!normalized)return {ok:false,frames,errors:[{code:"EMPTY",detail:"No transmission"}],discourse:{focusActor},normalized};
 const sections=splitSections(normalized);
 for(const section of sections){
  let text=section.text;
  const actorMentions=[...text.matchAll(subjectRx)];
  // The first named crew member is the subject unless the name is in
  // a subordinate WHEN/UNTIL condition.
  const lead=actorMentions.find(m=>!/^(?:when|once|until|if)\s*$/i.test(text.slice(0,m.index).trim().split(/\s+/).at(-1)||""));
  if(lead){
    focusActor=ACTORS[lead[0]];
    text=(text.slice(0,lead.index)+text.slice(lead.index+lead[0].length)).trim();
  }
  const atoms=splitActions(text);
  for(let j=0;j<atoms.length;j++){
   const raw=atoms[j].replace(/^(?:and|to|you|please)\s+/,"").trim();
   const {main,condition,error}=conditionFrom(raw);
   if(error){errors.push({...error,clause:raw});continue;}
   const action=classify(main);
   if(!action){errors.push({code:"UNKNOWN_ACTION",clause:raw});continue;}
   const actor=lead?focusActor:ROLES[action]||focusActor;
   if(!actor){errors.push({code:"MISSING_ACTOR",clause:raw});continue;}
   if(actor!==ROLES[action]){errors.push({code:"WRONG_CREW",clause:raw,actor,expected:ROLES[action]});continue;}
   const direction=directionOf(main);
   const degrees=["TURN","TRAVERSE"].includes(action)?parseAmount(main,"angle"):null;
   const distance=["ADVANCE","REVERSE"].includes(action)?parseAmount(main,"distance"):null;
   const bearing=action==="SPOT"?bearingOf(main):null;
   const ammo=action==="LOAD"?ammoOf(main):null;
   if(["TURN","TRAVERSE"].includes(action)&&!direction){errors.push({code:"MISSING_DIRECTION",clause:raw});continue;}
   if(degrees!==null&&(degrees<=0||degrees>360)){errors.push({code:"INVALID_ANGLE",clause:raw});continue;}
   if(distance!==null&&(distance<=0||distance>2000)){errors.push({code:"INVALID_DISTANCE",clause:raw});continue;}
   if(action==="SPOT"&&!bearing){errors.push({code:"MISSING_BEARING",clause:raw});continue;}
   if(bearing?.type==="ABSOLUTE"&&bearing.value>359){errors.push({code:"INVALID_BEARING",clause:raw});continue;}
   const relation=frames.length===0?"FIRST":j===0?section.relation:"CONCURRENT";
   const index=frames.length;
   frames.push({index,kind:"ORDER",actor,action,direction,degrees,distance,ammo,bearing,condition,relation,
    dependencies:relation==="AFTER"?[{type:"AFTER_FRAME",frame:index-1}]:[],raw});
  }
 }
 return {ok:errors.length===0&&frames.length>0,frames,errors,normalized,discourse:{focusActor}};
}
