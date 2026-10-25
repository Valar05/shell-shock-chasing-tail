// Canonical dialogue IDs. Audio backend is replaceable without changing game rules.
// Stable IDs become Pocket TTS filenames later: crew/<speaker>/<id>.wav.
export const CREW_LINES=Object.freeze({
 'delta.lost':{speaker:'delta',priority:4,text:'Lost sight of armor {location}. Last known bearing {bearing} degrees.'},
 'delta.reacquired':{speaker:'delta',priority:4,text:'Contact again! Bearing {bearing}, roughly {range} meters.'},
 'beta.lost':{speaker:'beta',priority:4,text:'Lost visual on Panzer {location}. Last known bearing {bearing} degrees. Watching for it.'},
 'beta.reacquired':{speaker:'beta',priority:4,text:'Reacquired Panzer! Bearing {bearing}, roughly {range} meters.'},
 'delta.contact':{speaker:'delta',priority:4,text:'Armor ahead! Bearing {bearing}, roughly {range} meters!'},
 'beta.contact':{speaker:'beta',priority:4,text:'Panzer in my sights! Bearing {bearing}, roughly {range} meters!'},
 'delta.advance':{speaker:'delta',priority:1,text:'Advancing, sir.'},
 'delta.reverse':{speaker:'delta',priority:1,text:'Reversing.'},
 'delta.halt':{speaker:'delta',priority:1,text:'Halted.'},
 'delta.turn':{speaker:'delta',priority:1,text:'Turning {direction} {degrees} degrees.'},
 'delta.turn.free':{speaker:'delta',priority:1,text:'Turning {direction}. Awaiting halt.'},
 'delta.turn.complete':{speaker:'delta',priority:1,text:'Turn complete. Holding heading.'},
 'delta.heading':{speaker:'delta',priority:1,text:'Coming around to {heading} degrees.'},
 'delta.breach':{speaker:'delta',priority:2,text:'Pushing through. Brace yourselves!'},
 'delta.blocked':{speaker:'delta',priority:2,text:'Blocked, sir. Need another route.'},
 'delta.clarify':{speaker:'delta',priority:2,text:'Which one, sir? Give me a bearing.'},
 'beta.acquire':{speaker:'beta',priority:1,text:'Traversing onto the target.'},
 'beta.laid':{speaker:'beta',priority:2,text:'On target. Gun laid.'},
 'beta.traverse':{speaker:'beta',priority:1,text:'Traversing {direction} {degrees} degrees.'},
 'beta.fire':{speaker:'beta',priority:1,text:'Firing when laid and loaded.'},
 'beta.hit':{speaker:'beta',priority:3,text:'Hit! {detail}'},
 'beta.hold':{speaker:'beta',priority:2,text:'Holding fire.'},
 'beta.no.target':{speaker:'beta',priority:2,text:'No confirmed target, sir.'},
 'beta.destroyed':{speaker:'beta',priority:5,text:'Panzer knocked out! Target destroyed!'},
 'gamma.loading':{speaker:'gamma',priority:1,text:'Loading {ammo}.'},
 'gamma.loaded':{speaker:'gamma',priority:2,text:'{ammo} loaded!'},
 'gamma.ready':{speaker:'gamma',priority:1,text:'{ammo} already in the breech.'},
 'silver.report':{speaker:'silver',priority:1,text:'{detail}'},
 'silver.contact':{speaker:'silver',priority:4,text:'Enemy armor! Bearing {bearing}!'},
 'silver.incoming':{speaker:'silver',priority:5,text:'Incoming! We took a hit!'},
 'silver.near.miss':{speaker:'silver',priority:4,text:'Panzer fired! Impact in the hedgerow!'},
 'silver.defeat':{speaker:'silver',priority:5,text:'We are hit! Abandon tank!'},
 'silver.clarify':{speaker:'silver',priority:2,text:'Say again, sir? {detail}'},
 'silver.standby':{speaker:'silver',priority:1,text:'Standing by for {detail}.'}
});
export function makeCrewLine(id,values={}){
 const entry=CREW_LINES[id];
 if(!entry)return null;
 const text=entry.text.replace(/\{(\w+)\}/g,(_,name)=>String(values[name]??'').trim()).replace(/\s+/g,' ').trim();
 return {id,speaker:entry.speaker,text,priority:entry.priority};
}
export function classifyCrewMessage(message=''){
 const m=String(message);
 const lost=m.match(/^(Beta|Delta): (?:Lost visual on Panzer|Lost sight of armor) (behind the farmhouse|behind the hedgerow|outside my sight)\. Last known bearing (\d+) degrees/i);
 if(lost)return makeCrewLine(lost[1].toLowerCase()+'.lost',{location:lost[2],bearing:lost[3]});
 const reacquired=m.match(/^(Beta|Delta): (?:Reacquired Panzer|Contact again)! Bearing (\d+) degrees, roughly (\d+) meters/i);
 if(reacquired)return makeCrewLine(reacquired[1].toLowerCase()+'.reacquired',{bearing:reacquired[2],range:reacquired[3]});
 if(/Delta: Armor ahead/i.test(m))return makeCrewLine('delta.contact',{bearing:m.match(/bearing\s+(\d+)/i)?.[1]||'unknown',range:m.match(/roughly\s+(\d+)/i)?.[1]||'unknown'});
 if(/Beta: Panzer in my sights/i.test(m))return makeCrewLine('beta.contact',{bearing:m.match(/bearing\s+(\d+)/i)?.[1]||'unknown',range:m.match(/roughly\s+(\d+)/i)?.[1]||'unknown'});
 if(/Delta: Turn complete/i.test(m))return makeCrewLine('delta.turn.complete');
 if(/Delta: Pushing through/i.test(m))return makeCrewLine('delta.breach');
 if(/Gamma: (AP|HE|SMOKE) loaded/i.test(m))return makeCrewLine('gamma.loaded',{ammo:m.match(/Gamma: (AP|HE|SMOKE) loaded/i)?.[1]});
 if(/Silver: Enemy Panzer/i.test(m))return makeCrewLine('silver.contact',{bearing:m.match(/bearing\s+(\d+)/i)?.[1]||'unknown'});
 if(/Silver: INCOMING/i.test(m))return makeCrewLine('silver.incoming');
 if(/Silver: Panzer fired/i.test(m))return makeCrewLine('silver.near.miss');
 if(/Silver: We are hit/i.test(m))return makeCrewLine('silver.defeat');
 if(/Beta: Panzer knocked out/i.test(m))return makeCrewLine('beta.destroyed');
 if(/Beta: HIT/i.test(m))return makeCrewLine('beta.hit',{detail:m.split('HIT!')[1]?.trim()||''});
 if(/Delta: Advancing/i.test(m))return makeCrewLine('delta.advance');
 if(/Delta: Reversing/i.test(m))return makeCrewLine('delta.reverse');
 if(/Delta: Halted/i.test(m))return makeCrewLine('delta.halt');
 if(/Delta: Turning to heading\s+(\d+)/i.test(m))return makeCrewLine('delta.heading',{heading:m.match(/heading\s+(\d+)/i)[1]});
 if(/Delta: Turning (left|right)/i.test(m)){
   const dir=m.match(/Delta: Turning (left|right)/i)[1];
   const degrees=m.match(/(\d+(?:\.\d+)?) degrees/i)?.[1];
   return degrees?makeCrewLine('delta.turn',{direction:dir,degrees}):makeCrewLine('delta.turn.free',{direction:dir});
 }
 if(/Beta: Traversing (left|right)/i.test(m))return makeCrewLine('beta.traverse',{direction:m.match(/Traversing (left|right)/i)[1],degrees:m.match(/(\d+) degrees/i)?.[1]||''});
 if(/Beta: Traversing onto/i.test(m))return makeCrewLine('beta.acquire');
 if(/Beta: No confirmed target/i.test(m))return makeCrewLine('beta.no.target');
 if(/Beta: Holding fire/i.test(m))return makeCrewLine('beta.hold');
 if(/Beta: Firing/i.test(m))return makeCrewLine('beta.fire');
 if(/Gamma: .*loading/i.test(m))return makeCrewLine('gamma.loading',{ammo:m.match(/Gamma: (AP|HE|SMOKE)/i)?.[1]||'selected round'});
 if(/Gamma: .*already loaded|already in breech/i.test(m))return makeCrewLine('gamma.ready',{ammo:m.match(/Gamma: (AP|HE|SMOKE)/i)?.[1]||'Round'});
 if(/Silver: Order not executed/i.test(m))return makeCrewLine('silver.clarify',{detail:m.replace(/^Silver:\s*/,'')});
 if(/Silver: Standing by|Crew: Standing by/i.test(m))return makeCrewLine('silver.standby',{detail:m.split('for ')[1]||'orders'});
 if(/^Silver:|^Beta:|^Gamma:|^Delta:/.test(m)){
  const speaker=m.split(':')[0].toLowerCase();
  return {id:speaker+'.report.dynamic',speaker,text:m.split(':').slice(1).join(':').trim(),priority:1};
 }
 return null;
}
