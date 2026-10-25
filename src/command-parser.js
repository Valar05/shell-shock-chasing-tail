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
  CRUSH_TREE:"delta",ADVANCE:"delta",REVERSE:"delta",HALT:"delta",TURN:"delta",
  TRAVERSE:"beta",ACQUIRE:"beta",FIRE:"beta",HOLD_FIRE:"beta",HEADING:"delta",
  LOAD:"gamma",REPORT:"silver",SPOT:"beta",RESTART:"alpha"
};
const SUBJECTS="driver|delta|chauffeur|gunner|beta|loader|gamma|silver|radio|operator|observer|alpha|commander";
const subjectRx=new RegExp("\\b("+SUBJECTS+")\\b","gi");
const ACTION_START=/\b(?:run over|knock down|flatten|crush|advance|proceed|drive|move|push|go|reverse|back(?:ward|wards)?|halt|stop|brake|turn|steer|rotate|pivot|traverse|slew|heading|head|face|orient|align|load|reload|chamber|select|fire|shoot|acquire|track|engage|report|status|sitrep|scan|look|hold|cease|restart|retry|spot|designate)\b/gi;
const NUMBER_WORDS={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90,hundred:100};
const vocabulary=[
  ["CRUSH_TREE",/\b(?:run over|knock down|flatten|crush|ram)\b(?=.*\b(?:tree|trees)\b)/],
  ["RESTART",/\b(restart|retry|new game|start over)\b/],
  ["SPOT",/\b(spot|designate|contact\s+(?:at|to|on)|enemy\s+(?:at|to|on)|target\s+(?:at|to|on)|bearing|azimuth|o'?clock)\b/],
  ["HOLD_FIRE",/\b(hold fire|cease fire|don't fire|do not fire)\b/],
  ["TRAVERSE",/\b(traverse|slew)\b/],
  ["HEADING",/\b(?:head(?:ing)?|face|orient|align|point us|square us|bring us around)\b/],
  ["HALT",/\b(halt|stop|brake|hold position)\b/],
  ["REVERSE",/\b(reverse|back(?:ward|wards)?|back up|pull back)\b/],
  ["TURN",/\b(turn|steer|rotate|pivot|swing)\b/],
  ["LOAD",/\b(load|reload|chamber|select|armor.piercing|armour.piercing|high.explosive|ap|he|smoke)\b/],
  ["FIRE",/\b(fire|shoot|send a round)\b/],
  ["ACQUIRE",/\b(acquire|track|engage|lay on|lock on)\b/],
  ["REPORT",/\b(report|status|sitrep|scan|look|what do you see|what can you see)\b/],
  ["ADVANCE",/\b(advance|proceed|drive|move|push|forward|ahead|continue|keep moving|go forward|go ahead|take us|bring us)\b/]
];

const ASR_ACTION_CORRECTIONS={advancd:"advance",advnace:"advance",advanced:"advance",advancing:"advance",advnced:"advance",advanc:"advance",trun:"turn",tern:"turn",turm:"turn",haltt:"halt",revers:"reverse",reverce:"reverse",travers:"traverse",traversed:"traverse",fier:"fire",fiire:"fire",reaload:"reload",reloaded:"reload",gunnerd:"gunner"};

// Constrained speech lattice: correct a *command slot* only, never a number,
// bearing, negative, crew name, or target. This avoids hallucinated orders.
const ACTION_LEXICON=[
 "advance","forward","proceed","drive","move","push","reverse","back","halt","stop",
 "turn","steer","rotate","pivot","traverse","slew","heading","face","orient","align",
 "load","reload","chamber","select","fire","shoot","acquire","track","engage",
 "report","status","sitrep","scan","look","hold","cease","restart","retry","spot","designate"
];
const ACTION_SPEECH_SYNONYMS={
 "advanced":"advance","advancing":"advance","advancd":"advance","advnace":"advance",
 "advnced":"advance","advanc":"advance","advenced":"advance","advans":"advance",
 "foward":"forward","forword":"forward","forwards":"forward","reverce":"reverse",
 "revers":"reverse","reversed":"reverse","reversing":"reverse",
 "turnt":"turn","turning":"turn","trun":"turn","tern":"turn",
 "traversed":"traverse","traversing":"traverse","travers":"traverse",
 "fired":"fire","firing":"fire","fier":"fire","fiire":"fire",
 "loaded":"load","loading":"load","reaload":"reload",
 "stoped":"stop","stopped":"stop","haltt":"halt","reporting":"report"
};
function editDistance(a,b){
 if(Math.abs(a.length-b.length)>2)return 3;
 const m=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){
  let last=m[0];m[0]=i;
  for(let j=1;j<=b.length;j++){
   const save=m[j];
   m[j]=Math.min(m[j]+1,m[j-1]+1,last+(a[i-1]===b[j-1]?0:1));
   last=save;
  }
 }
 return m[b.length];
}
function correction(word){
 if(ACTION_SPEECH_SYNONYMS[word])return ACTION_SPEECH_SYNONYMS[word];
 if(ACTION_LEXICON.includes(word)||word.length<5)return word;
 const found=ACTION_LEXICON.filter(v=>v.length>=5&&editDistance(word,v)===1);
 return found.length===1?found[0]:word;
}
export function normalizeCommandSlots(text){
 // A question is information seeking. Never fuzzy-map its words to orders.
 if(/^(?:(?:driver|delta|gunner|beta|loader|gamma|silver|radio|observer|alpha|commander)\s+)?(?:who|what|where|when|why|how|can|could|are|is|do|does|did|will|would|which|tell me)\b/.test(text))return text;
 // Only words in a plausible action position after an actor or a connector
 // are candidates for fuzzy repair. All other words remain literal.
 const parts=text.split(/(\s+)/);
 const actors=new Set(Object.keys(ACTORS));
 const connectors=new Set(["and","then","while","after","meanwhile"]);
 let open=true;
 for(let i=0;i<parts.length;i++){
  const word=parts[i];if(!/^[a-z]+$/.test(word))continue;
  const previous=i>=2?parts[i-2]:"";
  if(["when","once","until","if"].includes(word)){open=false;continue;}
  if(!open&&["reports","says","loaded","locked"].includes(word))continue;
  if(actors.has(previous)||connectors.has(previous)||actors.has(word)){if(!parts.slice(0,i).join("").match(/\b(?:when|once|until|if)\b[^;.!?]*$/))open=true;if(actors.has(word))continue;}
  if(open&&!["us","the","to","you","please","just"].includes(word)){
   const fixed=correction(word);
   parts[i]=fixed;
   // Once a command verb starts, arguments are never autocorrected.
   if(ACTION_LEXICON.includes(fixed))open=false;
  }
 }
 return parts.join("");
}

export function normalizeSpeech(input){
  return String(input??"").toLowerCase()
    .replace(/[’‘]/g,"'").replace(/[“”]/g,'"')
    .replace(/(\d)\s*°/g,"$1 degrees")
    // ASR naturally emits "one hundred and eighty degrees"; this "and" is
    // part of the number, not a compound-order connector.
    .replace(/\bhundred\s+and\s+(?=(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b)/g,"hundred ")
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
  const units=kind==="distance"?/(?:meters?|metres?|yards?|feet|foot)\b/:/(?:degrees?|deg)\b/;
  const matched=raw.match(kind==="distance"?/\b((?:\d+(?:\.\d+)?|[\w -]+))\s*(meters?|metres?|yards?|feet|foot)\b/:
    /\b((?:\d+(?:\.\d+)?|[\w -]+))\s*(degrees?|deg)\b/);
  if(matched){const n=numeric(matched[1]);if(n===null)return null;
    return kind==="distance"?(matched[2].startsWith("yard")?n*.9144:matched[2].startsWith("f")?n*.3048:n):n;}
  if(kind==="angle")return numeric(raw);
  return null;
}

// Directly adapted from Truth First v6.3 parser.mjs splitActorSubjects.
// Multiple named recipients may be spoken without explicit punctuation.
// The guard keeps subordinate subjects ("when Gunner reports locked") inside
// the parent condition rather than inventing another instruction.
function splitActorSubjects(chunk){
 const mentions=[...chunk.matchAll(subjectRx)];
 const starts=[];
 for(const m of mentions){
  const before=chunk.slice(0,m.index);
  if(/\b(?:when|once|until|if)\s*$/i.test(before))continue;
  if(/\b(?:when|once|until|if)\b[^;.!?]*$/i.test(before))continue;
  starts.push(m.index);
 }
 if(starts.length<=1)return [chunk.trim()].filter(Boolean);
 const out=[];
 for(let i=0;i<starts.length;i++){
  const piece=chunk.slice(starts[i],i+1<starts.length?starts[i+1]:chunk.length).replace(/^[,\s]+|[,\s]+$/g,"").trim();
  if(piece)out.push(piece);
 }
 const prefix=chunk.slice(0,starts[0]).trim();
 if(prefix&&out.length)out[0]=(prefix+" "+out[0]).trim();
 return out;
}

function splitSections(text){
  // Preserve connectors as graph edges. "and" between two verbs stays inside
  // a concurrent packet; "then" creates an explicit dependency.
  const connectors=/(\s*[;.!?]+\s*|\s+and then\s+|\s+then\s+|\s+after that\s+|\s+while\s+|\s+meanwhile\s+|\s+and\s+(?=(?:driver|delta|chauffeur|gunner|beta|loader|gamma|silver|radio|observer|commander|alpha)\b))/gi;
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
  return out.flatMap(section=>splitActorSubjects(section.text).map((part,i)=>({text:part,relation:i===0?section.relation:'CONCURRENT'})));
}
function splitActions(section){
  // Exact command: "30 degrees to the left and run over that tree".
  // A standalone directional quantity followed by an imperative forms two clauses.
  const implicit=section.match(/^((?:\d+|[a-z -]+)\s+degrees?\s+to\s+the\s+(?:left|right))\s+and\s+(.+)$/);
  if(implicit){
    ACTION_START.lastIndex=0;
    if(ACTION_START.test(implicit[2])){ACTION_START.lastIndex=0;return [implicit[1],implicit[2]];}
    ACTION_START.lastIndex=0;
  }
  const matches=[...section.matchAll(ACTION_START)];
  const starts=[];
  for(const m of matches){
    // "go forward" should be one action; "reports locked" isn't an order.
    if(starts.length&&/\b(?:go|move|drive|push|hold|cease|report)\s+$/.test(section.slice(starts.at(-1),m.index)))continue;
    if(starts.length&&/^\s+status\b/.test(section.slice(starts.at(-1),m.index+m[0].length)))continue;
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
  if(/\b(?:heading|face|orient|align|point us|square us|bring us around)\b/.test(raw))return "HEADING";
  if(/\b(?:turn|steer|rotate|pivot)\s+(?:us\s+)?(?:to|towards?|onto)\s+(?:bearing|azimuth|heading|north|south|east|west|\d)/.test(raw))return "HEADING";
  const found=vocabulary.filter(([,rx])=>rx.test(raw)).map(([action])=>action);
  if(!found.length){
    if(/\b(left|right)\b/.test(raw))return "TURN";
    return null;
  }
  // A turn may be implicit in the phrase "advance left"; it is split
  // into movement plus turn upstream when another action is explicit.
  return found[0];
}

// Query recognition is adapted from Truth First v6.3 parseQuery. Questions
// inspect information; they must NEVER accidentally trigger movement/fire.
function queryTypeOf(raw){
 const text=raw.trim().replace(/^,+\s*/,"");
 if(!/^(?:who|what|where|when|why|how|can|could|are|is|do|does|did|will|would|which|report|status|sitrep|tell me)\b/.test(text))return null;
 if(/\b(?:ammo|ammunition|rounds?|shells?|loaded|reload|loading|breech)\b/.test(text))return "AMMO";
 if(/\b(?:heading|bearing|direction|azimuth|facing|pointing)\b/.test(text))return "HEADING";
 if(/\b(?:speed|moving|movement|advancing|stopped|distance|driving)\b/.test(text))return "MOTION";
 if(/\b(?:gun|laid|ready to fire|aim|lock|target acquired)\b/.test(text))return "GUN";
 if(/\b(?:enemy|contact|panzer|opposition|hostile|threat)\b/.test(text))return "CONTACT";
 if(/\b(?:see|seeing|visible|look|spot|eyes on)\b/.test(text))return "OBSERVATION";
 if(/\b(?:options|orders|commands|can we|can you|capable)\b/.test(text))return "CAPABILITY";
 if(/\b(?:objective|mission)\b/.test(text))return "OBJECTIVE";
 if(/\b(?:report|status|sitrep|how are we|how's the tank)\b/.test(text))return "STATUS";
 return "STATUS";
}

function conditionFrom(raw){
  const m=raw.match(/\b(when|once|until|if|after)\s+(.+)$/);
  if(!m)return {main:raw,condition:null,error:null};
  const main=raw.slice(0,m.index).trim(),tail=m[2].trim();
  if(/\b(?:gunner|beta)\b.*\b(?:locked|laid|on target|ready)\b|\bgun(?:\s+is)?\s+laid\b/.test(tail))
    return {main,condition:{type:"GUNNER_LOCKED",mode:m[1].toUpperCase()},error:null};
  if(/\b(?:loader|gamma)\b.*\b(?:ready|loaded|finished)\b|\b(?:gun|round|shell)\s+(?:is\s+)?loaded\b|^loaded\b/.test(tail))
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
  const degrees=raw.match(/\b(?:bearing|azimuth|heading|turn to|turn us to|align to|align us to|face)\s*(\d{1,3})\s*(?:degrees?|deg)?\b/);
  if(degrees)return {type:"ABSOLUTE",value:Number(degrees[1])};
  const spoken=raw.match(/\b(?:bearing|azimuth|heading|turn to|turn us to|align to|face)\s+((?:[a-z]+(?:\s+and)?\s*){1,5})(?:degrees?|deg)?\s*$/);
  if(spoken){const value=numeric(spoken[1]);if(value!==null)return {type:"ABSOLUTE",value};}
  const cardinal=raw.match(/\b(north(?:east|west)?|south(?:east|west)?|east|west)\b/);
  if(cardinal)return {type:"CARDINAL",value:cardinal[1]};
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
 const normalized=normalizeCommandSlots(normalizeSpeech(input)),frames=[],errors=[];
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
  const stageDependencies=section.relation==='AFTER'&&frames.length?[{type:'AFTER_FRAME',frame:frames.length-1}]:[];
  for(let j=0;j<atoms.length;j++){
   const raw=atoms[j].replace(/^(?:and|to|you|please)\s+/,"").replace(/\s+(?:and|then)\s*$/,"").trim();
   const queryType=queryTypeOf(raw);
   const {main,condition,error}=queryType?{main:raw,condition:null,error:null}:conditionFrom(raw);
   if(error){errors.push({...error,clause:raw});continue;}
   const action=queryType?"REPORT":classify(main);
   if(!action){errors.push({code:"UNKNOWN_ACTION",clause:raw});continue;}
   const actor=queryType?(lead?focusActor:"silver"):(lead?focusActor:ROLES[action]||focusActor);
   if(!actor){errors.push({code:"MISSING_ACTOR",clause:raw});continue;}
   if(!queryType&&actor!==ROLES[action]&&!(action==="SPOT"&&["alpha","beta","silver"].includes(actor))){errors.push({code:"WRONG_CREW",clause:raw,actor,expected:ROLES[action]});continue;}
   const direction=directionOf(main);
   const degrees=["TURN","TRAVERSE"].includes(action)?parseAmount(main,"angle"):null;
   const distance=["ADVANCE","REVERSE"].includes(action)?parseAmount(main,"distance"):null;
   // A direction attached to a tree objective is a relative target bearing,
   // NOT a new TURN order. Preserve the exact angle in the command frame.
   const targetOffset=action==="CRUSH_TREE"&&direction?parseAmount(main,"angle"):null;
   const bearing=["SPOT","HEADING"].includes(action)?bearingOf(main):null;
   const ammo=action==="LOAD"?ammoOf(main):null;
   const speedProfile=/\b(slowly|carefully|cautiously|crawl)\b/.test(main)?"SLOW":/\b(full speed|quickly|rapidly|fast|maximum speed)\b/.test(main)?"FAST":"NORMAL";
   const destination=["ADVANCE","REVERSE"].includes(action)?main.match(/\b(?:to|toward|towards|up to|past|through|across)\s+(?:the\s+)?(orchard|hedge|hedgerow|house|farmhouse|road|tree line|enemy)\b/)?.[1]||null:null;
   if(destination){errors.push({code:"ROUTE_UNAVAILABLE",clause:raw,target:destination,detail:"Destination understood, but autonomous navigation is not yet implemented."});continue;}
   if(["TURN","TRAVERSE"].includes(action)&&!direction){errors.push({code:"MISSING_DIRECTION",clause:raw});continue;}
   if(["TURN","TRAVERSE"].includes(action)&&/\b(left|port)\b/.test(main)&&/\b(right|starboard)\b/.test(main)){errors.push({code:"CONTRADICTORY_DIRECTIONS",clause:raw});continue;}
   if(["TURN","TRAVERSE","HEADING"].includes(action)&&/\b(?:meters?|metres?|yards?|feet|foot)\b/.test(main)){errors.push({code:"INVALID_UNIT",clause:raw});continue;}
   if(["ADVANCE","REVERSE"].includes(action)&&/\b(?:degrees?|deg)\b/.test(main)){errors.push({code:"INVALID_UNIT",clause:raw});continue;}
   if(/-\d+(?:\.\d+)?/.test(main)){errors.push({code:"NEGATIVE_QUANTITY",clause:raw});continue;}
   if(action==="LOAD"&&/\b(?:ap|armor.piercing|armour.piercing)\b/.test(main)&&/\b(?:he|high.explosive|smoke)\b/.test(main)){errors.push({code:"CONFLICTING_AMMUNITION",clause:raw});continue;}
   if(action==="LOAD"&&/\b(?:he|high.explosive)\b/.test(main)&&/\bsmoke\b/.test(main)){errors.push({code:"CONFLICTING_AMMUNITION",clause:raw});continue;}
   if(/\band\s+(?!slowly\b|carefully\b|cautiously\b|quietly\b|steadily\b)/.test(main)){errors.push({code:"UNPARSED_CONJUNCTION",clause:raw});continue;}
   if(targetOffset!==null&&(targetOffset<=0||targetOffset>180)){errors.push({code:"INVALID_RELATIVE_BEARING",clause:raw});continue;}
   if(degrees!==null&&(degrees<=0||degrees>360)){errors.push({code:"INVALID_ANGLE",clause:raw});continue;}
   if(distance!==null&&(distance<=0||distance>2000)){errors.push({code:"INVALID_DISTANCE",clause:raw});continue;}
   if(["SPOT","HEADING"].includes(action)&&!bearing){errors.push({code:"MISSING_BEARING",clause:raw});continue;}
   if(bearing?.type==="ABSOLUTE"&&bearing.value>359){errors.push({code:"INVALID_BEARING",clause:raw});continue;}
   if(condition?.mode==="UNTIL"&&!["ADVANCE","REVERSE","TURN","TRAVERSE"].includes(action)){errors.push({code:"INVALID_UNTIL",clause:raw});continue;}
   const relation=frames.length===0?"FIRST":j===0?section.relation:"CONCURRENT";
   const index=frames.length;
   frames.push({index,kind:queryType?"QUERY":"ORDER",queryType,actor,action,direction,degrees,distance,targetOffset,ammo,bearing,speedProfile,condition,relation,
    dependencies:stageDependencies.map(d=>({...d})),raw});
  }
 }
 // A THEN dependency requires the prior order to have a determinable finish.
 for(const frame of frames){
   const predecessor=frame.dependencies?.[0]&&frames[frame.dependencies[0].frame];
   if(predecessor&&["ADVANCE","REVERSE","TURN","TRAVERSE"].includes(predecessor.action)&&
      predecessor.degrees===null&&predecessor.distance===null&&!predecessor.condition){
     errors.push({code:"NON_TERMINATING_DEPENDENCY",clause:frame.raw});
   }
 }
 // Concurrent contradictory instructions are rejected atomically, not applied last-wins.
 const driving=new Set(["ADVANCE","REVERSE","HALT"]);
 const turning=new Set(["TURN","HEADING"]);
 for(let i=0;i<frames.length;i++)for(let j=i+1;j<frames.length;j++){
   if(frames[j].relation!=="CONCURRENT")break;
   const a=frames[i],b=frames[j];
   const conflict=a.actor===b.actor&&(
     (driving.has(a.action)&&driving.has(b.action))||
     (turning.has(a.action)&&turning.has(b.action))||
     (a.action==="LOAD"&&b.action==="LOAD")||
     (["FIRE","HOLD_FIRE"].includes(a.action)&&["FIRE","HOLD_FIRE"].includes(b.action)));
   if(conflict)errors.push({code:"CONFLICTING_CONCURRENT_ORDERS",clause:a.raw+" / "+b.raw});
 }
 return {ok:errors.length===0&&frames.length>0,frames,errors,normalized,discourse:{focusActor}};
}
