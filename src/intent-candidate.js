// Tiny character n-gram prototype: no model distribution, no external runtime.
// This is a LEARNED-like nearest-prototype candidate, not a neural ONNX classifier.
// Deliberately conservative: it MAY suggest actions, never authorizes execution.
const prototypes=[
 ["HALT","driver halt"],["HALT","delta halt"],["HALT","stop the tank"],["HALT","driver stop"],
 ["TURN","turn left"],["TURN","turn right"],["TURN","steer left"],["TURN","steer right"],["TURN","rotate left"],
 ["CRUSH_TREE","run over that tree"],["CRUSH_TREE","crush the tree"],["CRUSH_TREE","flatten that tree"],
 ["HOLD_FIRE","beta do not fire"],["HOLD_FIRE","beta don't fire"],["HOLD_FIRE","hold fire"],["HOLD_FIRE","cease fire"],
 ["FIRE","beta fire"],["FIRE","gunner shoot"]
];
const grams=s=>{const z='  '+s.toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim()+'  ',out=new Map();for(let i=0;i<z.length-2;i++){const g=z.slice(i,i+3);out.set(g,(out.get(g)||0)+1)}return out};
const bank=prototypes.map(([intent,example])=>({intent,example,grams:grams(example)}));
function similarity(a,b){let dot=0,aa=0,bb=0;for(const [k,v] of a){aa+=v*v;dot+=v*(b.get(k)||0)}for(const v of b.values())bb+=v*v;return aa&&bb?dot/Math.sqrt(aa*bb):0}
export function suggestIntent(transcript){
 const q=grams(transcript),ranked=bank.map(p=>({...p,score:similarity(q,p.grams)})).sort((a,b)=>b.score-a.score);
 const top=ranked[0],runner=ranked.find(p=>p.intent!==top.intent);
 return {intent:top.intent,score:Math.round(top.score*1000)/1000,margin:Math.round((top.score-(runner?.score||0))*1000)/1000,exemplar:top.example,
   // Trigram similarity is NOT calibrated probability. Never auto-execute from this.
   authorized:false};
}
