// Adapted command-frame architecture from Valar05/truth-first-rpg v6.3.
// Parse surface language to explicit atomic frames before executing game state.
const actors=[['driver','delta'],['gunner','beta'],['loader','gamma'],['observer','silver'],['commander','alpha']];
const aliases=new Map(actors.flatMap(([role,call])=>[[role,call],[call,call]]));
const actorRx=/\b(driver|delta|gunner|beta|loader|gamma|observer|silver|commander|alpha)\b/gi;
const verbs=/\b(advance|forward|move|proceed|drive|reverse|back up|back|halt|stop|turn|steer|rotate|pivot|left|right|report|status|sitrep|scan|look|acquire|track|target|engage|fire|shoot|load|reload|select|hold|cease|restart|retry)\b/i;
const actions=[
 ['HALT',/\b(halt|stop|brake)\b/i],
 ['REVERSE',/\b(reverse|back up|backward|backwards)\b/i],
 ['ADVANCE',/\b(advance|forward|move|proceed|drive|go ahead)\b/i],
 ['TURN',/\b(turn|steer|rotate|pivot|left|right)\b/i],
 ['LOAD',/\b(load|reload|select|chamber)\b/i],
 ['FIRE',/\b(fire|shoot)\b/i],
 ['ACQUIRE',/\b(acquire|track|target|engage)\b/i],
 ['REPORT',/\b(report|status|sitrep|scan|look)\b/i],
 ['RESTART',/\b(restart|retry)\b/i],
];
const numberWords={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,fifteen:15,twenty:20,thirty:30,forty:40,'forty five':45,sixty:60,ninety:90,'one hundred':100,'one eighty':180};
export function normalizeSpeech(input){return String(input||'').toLowerCase().replace(/[’]/g,"'").replace(/[“”]/g,'"').replace(/\buh+\b|\bum+\b|\bplease\b/gi,' ').replace(/(\d)\s*°/g,'$1 degrees').replace(/\s+/g,' ').trim();}
function degreesOf(s){const digit=s.match(/\b(\d+(?:\.\d+)?)\s*(?:degrees?|deg)?\b/);if(digit)return Number(digit[1]);const words=Object.keys(numberWords).sort((a,b)=>b.length-a.length);for(const w of words){if(new RegExp('\\b'+w+'\\b').test(s))return numberWords[w];}return null;}
function splitActions(clause){const out=[];const parts=clause.split(/\s+(?:and then|then|after that|while|and)\s+/i);let offset=0;for(const part of parts){const clean=part.trim();if(clean){out.push({text:clean,relation:offset===0?'FIRST':/\b(?:then|after that)\b/i.test(clause.split(clean)[0])?'AFTER':'CONCURRENT'});offset++;}}return out;}
function splitMultiVerb(text){const rx=/\b(?:advance|forward|move|reverse|halt|stop|turn|steer|rotate|pivot|load|reload|fire|shoot|acquire|track|report|status)\b/gi;const matches=[...text.matchAll(rx)];if(matches.length<2)return[text];const pieces=[];for(let i=0;i<matches.length;i++){const start=i===0?0:matches[i].index;const end=i+1<matches.length?matches[i+1].index:text.length;const part=text.slice(start,end).trim();if(part)pieces.push(part);}return pieces;}
function pickAction(text){if(/\b(turn|steer|rotate|pivot)\b|\b(?:left|right)\b/.test(text))return 'TURN';for(const [type,re] of actions)if(re.test(text))return type;return null;}
export function parseTransmission(input,prior={}){
 const normalized=normalizeSpeech(input),frames=[],errors=[];
 let focusActor=prior.focusActor||null;
 const segments=normalized.split(/\s*(?:[;.!?]+)\s*|\s+and then\s+|\s+then\s+|\s+after that\s+|\s+while\s+/i).filter(Boolean);
 for(let si=0;si<segments.length;si++){
  const section=segments[si];
  const mentions=[...section.matchAll(actorRx)];
  const lead=mentions[0];if(lead)focusActor=aliases.get(lead[0].toLowerCase());
  const subject=lead?section.replace(actorRx,' ').trim():section;
  const atoms=splitMultiVerb(subject);
  for(let ai=0;ai<atoms.length;ai++){
   const raw=atoms[ai].trim().replace(/^(?:and|to|please)\s+/,'');
   const action=pickAction(raw);
   if(!action){errors.push({code:'UNKNOWN_ACTION',clause:raw});continue;}
   const actor=focusActor||({LOAD:'gamma',FIRE:'beta',ACQUIRE:'beta',REPORT:'silver',RESTART:'alpha'}[action]||null);
   if(!actor){errors.push({code:'MISSING_ACTOR',clause:raw});continue;}
   const direction=/(?<!\w)(left|right)(?!\w)/.exec(raw)?.[1]||null;
   const amount=action==='TURN'?degreesOf(raw):null;
   if(action==='TURN'&&!direction){errors.push({code:'MISSING_DIRECTION',clause:raw});continue;}
   if(amount!==null&&(amount<=0||amount>360)){errors.push({code:'INVALID_ANGLE',clause:raw});continue;}
   frames.push({kind:'ORDER',actor,action,direction,degrees:amount,ammo:/\b(ap|he|smoke)\b/.exec(raw)?.[1]||null,raw,relation:si===0&&ai===0?'FIRST':si>0?'AFTER':'CONCURRENT'});
  }
 }
 return {ok:errors.length===0&&frames.length>0,frames,errors,discourse:{focusActor},normalized};
}
