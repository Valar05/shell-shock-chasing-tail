#!/usr/bin/env python3
"""Tiny supervised char-n-gram intent learner. No pip, Torch, GPU or downloads.
Run: python campaigns/train_light_intent.py [doctor|train|status]
Dataset generated from semantic templates; fixed independent evaluation corpus in JS
is NOT used as training data.
"""
import collections, hashlib, json, math, os, pathlib, random, re, sys, time
BASE=pathlib.Path(os.environ.get("LOCALAPPDATA",str(pathlib.Path.home()))) / "RitsuCampaigns" / "shellshock-intent-20261026"
SEED=20261026
INTENTS={
 "HALT":["delta halt","driver stop","stop the tank","bring us to a halt","freeze our position","brake now"],
 "TURN":["turn left","turn right","rotate the hull","steer us left","pivot to starboard","swing to port"],
 "CRUSH_TREE":["run over the tree","flatten that tree","crush the oak","drive through that tree","knock down the tree"],
 "HOLD_FIRE":["hold your fire","cease fire beta","do not shoot","beta don't fire","keep weapons silent"],
 "FIRE":["gunner fire","beta take the shot","shoot the target","fire the cannon","engage and fire"],
 "OTHER":["what is our position","where are the enemies","look at the sky","how are you","tell me the time","hello crew"]
}
# Self-contained train/test: test instances use disjoint original *templates*.
TRAIN={k:v[:4] for k,v in INTENTS.items()}
TEST={k:v[4:] for k,v in INTENTS.items()}
def variations(s):
 out={s}
 for actor in ("driver ","delta ","beta "):
  if not s.startswith(actor):out.add(actor+s)
 if " " in s:out.add("please "+s)
 return sorted(out)
def grams(s):
 s="  "+re.sub(r"[^a-z0-9 ]","",s.lower()).strip()+"  "
 return collections.Counter(s[i:i+3] for i in range(len(s)-2))
def train():
 rng=random.Random(SEED); classes=sorted(TRAIN)
 counts={k:collections.Counter() for k in classes}
 n={k:0 for k in classes}
 examples=[]
 for label,templates in TRAIN.items():
  for t in templates:
   for v in variations(t):
    examples.append((label,v))
 rng.shuffle(examples)
 for label,v in examples:
  counts[label].update(grams(v)); n[label]+=1
 vocab=sorted(set().union(*(set(c) for c in counts.values())))
 # Add-one smoothed multinomial Naive Bayes; trained counts persisted, portable to JS.
 model={"schema":"shellshock.intent.char3.nb.v1","seed":SEED,"classes":classes,
        "prior":n,"counts":{k:dict(sorted(c.items())) for k,c in counts.items()},
        "totals":{k:sum(c.values()) for k,c in counts.items()},
        "vocabulary":vocab,"training_examples":len(examples)}
 return model
def predict(model,text):
 q=grams(text);v=len(model["vocabulary"]);total=sum(model["prior"].values())
 scores={}
 for label in model["classes"]:
  s=math.log(model["prior"][label]/total)
  denom=model["totals"][label]+v
  for gram,count in q.items():
   s+=count*math.log((model["counts"][label].get(gram,0)+1)/denom)
  scores[label]=s
 ordered=sorted(scores,key=lambda k:scores[k],reverse=True)
 return {"label":ordered[0],"runner":ordered[1],"log_margin":round(scores[ordered[0]]-scores[ordered[1]],3)}
def perform():
 BASE.mkdir(parents=True,exist_ok=True)
 model=train()
 selftest=[]
 for k,templates in TEST.items():
  for t in templates:selftest.append({"expected":k,"input":t,**predict(model,t)})
 digest=hashlib.sha256(json.dumps(model,sort_keys=True).encode()).hexdigest()
 report={"stage":"trained","utc":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),
         "model_sha256":digest,"training_examples":model["training_examples"],
         "heldout_templates":len(selftest),
         "heldout_correct":sum(x["expected"]==x["label"] for x in selftest),
         "heldout":selftest,
         "caution":"Text-only small template study; does not authorize tank actions or claim mobile ASR accuracy."}
 (BASE/"intent-model.json").write_text(json.dumps(model,sort_keys=True)+"\n",encoding="utf-8")
 (BASE/"receipt.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
 print(json.dumps({k:v for k,v in report.items() if k!="heldout"},indent=2))
def main():
 if len(sys.argv)!=2 or sys.argv[1] not in ("doctor","train","status"):raise SystemExit("Usage: python campaigns/train_light_intent.py doctor|train|status")
 if sys.argv[1]=="doctor":
  print(json.dumps({"python":sys.version.split()[0],"free_bytes":__import__("shutil").disk_usage(BASE.parent if BASE.parent.exists() else pathlib.Path.home()).free,"no_external_dependencies":True}))
 elif sys.argv[1]=="status":
  p=BASE/"receipt.json";print(p.read_text(encoding="utf-8") if p.exists() else "No run yet")
 else:perform()
if __name__=="__main__":main()
