#!/usr/bin/env python3
"""Standard-library averaged perceptron adversarial text-intent experiment. Usage: python campaigns/train_intent_v2.py doctor|train|status"""
import collections,hashlib,json,os,random,re,shutil,sys,time
from pathlib import Path
OUT=Path(os.environ.get("LOCALAPPDATA",str(Path.home()))) / "RitsuCampaigns" / "shellshock-intent-v2"
SEED=20261026
TRAIN={
"TURN":["turn thirty degrees left","turn forty degrees right","steer to the right","pivot the hull","swing to port","rotate starboard"],
"HALT":["driver halt","stop the tank","delta stop","brake immediately","come to a stop","hold our position"],
"CRUSH_TREE":["run over that tree","flatten the oak","crush the tree","drive through the tree","knock down the oak"],
"HOLD_FIRE":["beta do not fire","cease fire","hold your fire","do not shoot","keep weapons silent"],
"FIRE":["beta fire on target","gunner fire","shoot the target","take the shot","engage and fire"],
"OTHER":["what is our position","tell me a joke","driver hall is a name","there is a fire in the barn","how far right","the tree is on fire"]
}
# Test templates are held out, never used to generate training examples.
HOLDOUT={
"TURN":["turn 30 degrees left","steer us to port","rotate forty degrees starboard"],
"HALT":["driver holt","stop right there","come to a halt"],
"CRUSH_TREE":["ram that tree","run that oak down"],
"HOLD_FIRE":["beta dont shoot","no firing beta","do not fire"],
"FIRE":["gunner take aim and fire","shoot that target"],
"OTHER":["driver hall","fire engine nearby","beta fire drill","forty degrees of freedom","what a lovely tree"]
}
CRITICAL=[("beta do not fire","HOLD_FIRE"),("beta fire drill","OTHER"),("turn right for debris","TURN"),("driver hall","OTHER"),("there is a fire in the barn","OTHER")]
LABELS=tuple(sorted(TRAIN))
def features(s):
 s=re.sub(r"[^a-z0-9 ]"," ",s.lower());s=re.sub(r"\s+"," ",s).strip();d=collections.Counter()
 for w in s.split():d["w:"+w]+=2
 for n in (3,4):
  t="  "+s+"  "
  for i in range(len(t)-n+1):d["c"+str(n)+":"+t[i:i+n]]+=1
 return d
def samples():
 data=[]
 for label,phrases in TRAIN.items():
  for phrase in phrases:
   for variant in (phrase,"please "+phrase,phrase+" now",phrase+" sir"):
    data.append((label,variant))
 random.Random(SEED).shuffle(data);return data
def train():
 data=samples();w={k:collections.defaultdict(float) for k in LABELS};total={k:collections.defaultdict(float) for k in LABELS}
 count=0
 for epoch in range(25):
  random.Random(SEED+epoch).shuffle(data)
  for gold,text in data:
   f=features(text);scores={k:sum(w[k][j]*v for j,v in f.items()) for k in LABELS}
   pred=max(LABELS,key=lambda k:(scores[k],-LABELS.index(k)))
   if pred!=gold:
    for j,v in f.items():w[gold][j]+=v;w[pred][j]-=v
   for k in LABELS:
    for j,v in w[k].items():
     if v:total[k][j]+=v
   count+=1
 return {"schema":"shellshock.intent.linear.v2","labels":LABELS,"seed":SEED,"training_examples":len(data),
         "weights":{k:{j:round(v/count,6) for j,v in x.items() if v} for k,x in total.items()},
         "authority":"advisory_only"}
def predict(m,s):
 f=features(s);return max(LABELS,key=lambda k:sum(m["weights"][k].get(j,0)*v for j,v in f.items()))
def receipt(stage,**kwargs):
 OUT.mkdir(parents=True,exist_ok=True);r={"stage":stage,"utc":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),**kwargs}
 (OUT/"receipt.json").write_text(json.dumps(r,indent=2)+"\n");print(json.dumps(r,indent=2))
def main():
 if len(sys.argv)!=2 or sys.argv[1] not in ("doctor","train","status"):raise SystemExit("Usage: train_intent_v2.py doctor|train|status")
 mode=sys.argv[1]
 if mode=="status":
  p=OUT/"receipt.json";print(p.read_text() if p.exists() else "No receipt");return
 if sys.version_info<(3,10):raise RuntimeError("Python 3.10+ required")
 free=shutil.disk_usage(OUT.parent if OUT.parent.exists() else Path.home()).free
 if free<100*1024*1024:raise RuntimeError("Less than 100 MiB free")
 if mode=="doctor":receipt("doctor_passed",free_bytes=free,python=sys.version.split()[0]);return
 m=train();rows=[{"expected":k,"phrase":s,"predicted":predict(m,s)} for k,a in HOLDOUT.items() for s in a]
 rows += [{"expected":k,"phrase":s,"predicted":predict(m,s),"critical":True} for s,k in CRITICAL]
 OUT.mkdir(parents=True,exist_ok=True)
 b=json.dumps(m,sort_keys=True).encode();(OUT/"model.json").write_bytes(b)
 (OUT/"evaluation.json").write_text(json.dumps(rows,indent=2))
 receipt("trained_evaluated",training_examples=m["training_examples"],heldout_count=len(rows),
         heldout_correct=sum(x["expected"]==x["predicted"] for x in rows),
         critical_misclassified=sum(x["expected"]!=x["predicted"] for x in rows if x.get("critical")),
         model_bytes=len(b),model_sha256=hashlib.sha256(b).hexdigest(),
         advisory_only=True,free_bytes=free)
if __name__=="__main__":
 try:main()
 except Exception as e:print("CAMPAIGN_FAILED",e,file=sys.stderr);sys.exit(1)
