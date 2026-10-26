#!/usr/bin/env python3
"""Shell Shock human-voice Sherpa benchmark. Windows/Python 3.10+. Usage: python campaigns/run_human_asr.py doctor|run|status"""
import hashlib,json,os,shutil,subprocess,sys,tarfile,time,urllib.request
from pathlib import Path
BASE=Path(os.environ.get("LOCALAPPDATA",str(Path.home()))) / "RitsuCampaigns" / "shellshock-human-asr-20261025"
REPO="https://github.com/Valar05/shell-shock-chasing-tail.git"
BRANCH="campaign/human-voice-fixtures-20261025"
FIXTURES_SHA="b5367068e8ef7f659bb801912863a133198646a2"
MODELS={"zipformer":"sherpa-onnx-streaming-zipformer-en-20M-2023-02-17","sensevoice":"sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17"}
def command(args,cwd=None):
    p=subprocess.run([str(a) for a in args],cwd=cwd,capture_output=True,text=True)
    if p.returncode:raise RuntimeError(str(args)+" exited "+str(p.returncode)+": "+(p.stdout+p.stderr)[-1800:])
    return p.stdout.strip()
def digest(p):
    h=hashlib.sha256()
    with open(p,"rb") as f:
        for b in iter(lambda:f.read(1048576),b""):h.update(b)
    return h.hexdigest()
def receipt(stage,**kw):
    BASE.mkdir(parents=True,exist_ok=True)
    value={"stage":stage,"time_utc":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"fixture_commit":FIXTURES_SHA,**kw}
    (BASE/"status.json").write_text(json.dumps(value,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(value,indent=2),flush=True)
def doctor():
    if sys.version_info < (3,10):raise RuntimeError("Python 3.10+ required")
    if shutil.which("git") is None:raise RuntimeError("Git missing from PATH")
    print("python",sys.version.split()[0],"git",command(["git","--version"]),"base",BASE)
def checkout():
    root=BASE/"repo"
    if not root.exists():command(["git","clone","--quiet","--single-branch","--branch",BRANCH,REPO,root])
    if not (root/".git").is_dir():raise RuntimeError("Existing workspace is not a Git checkout")
    if command(["git","status","--porcelain"],root):raise RuntimeError("Dirty checkout, refusing to overwrite")
    if command(["git","branch","--show-current"],root)!=BRANCH:raise RuntimeError("Wrong campaign branch")
    command(["git","merge-base","--is-ancestor",FIXTURES_SHA,"HEAD"],root)
    return root
def fixtures(root):
    folder=root/"research"/"human-asr-benchmark"
    data=json.loads((folder/"manifest.json").read_text(encoding="utf-8"))
    if len(data["cases"])!=4:raise RuntimeError("Expected exactly 4 voice fixtures")
    for c in data["cases"]:
        rel=Path(c["file"])
        if len(rel.parts)!=2 or rel.parts[0]!="fixtures" or digest(folder/rel)!=c["sha256"]:raise RuntimeError("Fixture checksum/path invalid: "+str(rel))
    return folder
def env_python():
    target=BASE/"venv"
    exe=target/("Scripts/python.exe" if os.name=="nt" else "bin/python")
    if not exe.is_file():command([sys.executable,"-m","venv",target])
    marker=BASE/"requirements-ok"
    if not marker.exists():
        command([exe,"-m","pip","install","--disable-pip-version-check","numpy","sherpa-onnx"])
        command([exe,"-c","import numpy, sherpa_onnx"])
        marker.write_text("OK")
    return exe
def download_model(name):
    model_dir=BASE/"models";target=model_dir/name
    if (target/"tokens.txt").is_file():return target
    model_dir.mkdir(parents=True,exist_ok=True)
    archive=model_dir/(name+".tar.bz2")
    if not archive.is_file():
        part=model_dir/(name+".partial")
        url="https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/"+name+".tar.bz2"
        try:
            with urllib.request.urlopen(url,timeout=60) as src,open(part,"wb") as dst:shutil.copyfileobj(src,dst)
            os.replace(part,archive)
        finally:
            if part.exists():part.unlink()
    with tarfile.open(archive,"r:bz2") as t:
        base=model_dir.resolve()
        for m in t.getmembers():
            if m.issym() or m.islnk() or not (model_dir/m.name).resolve().is_relative_to(base):raise RuntimeError("Unsafe archive entry")
        t.extractall(model_dir) # validated members; Python 3.10-compatible
    if not (target/"tokens.txt").is_file():raise RuntimeError("Model unpack failed: "+name)
    return target
def execute():
    receipt("started")
    try:
        doctor();root=checkout();folder=fixtures(root);receipt("fixture_check_passed")
        exe=env_python();receipt("dependencies_ready")
        for engine,model in MODELS.items():
            mp=download_model(model);receipt("model_ready",engine=engine)
            result=folder/"results"/(engine+".json");result.parent.mkdir(parents=True,exist_ok=True)
            if not result.exists():
                log=command([exe,folder/"benchmark.py","--engine",engine,"--model-dir",mp,"--repeats","5","--output",result],root)
                (BASE/(engine+".log")).write_text(log+"\n",encoding="utf-8")
            rows=json.loads(result.read_text(encoding="utf-8"))["rows"]
            if len(rows)!=20:raise RuntimeError("Expected 20 human audio trials for "+engine)
            receipt("engine_complete",engine=engine,trials=20)
        resultdir=folder/"results"
        summary=command([exe,folder/"score.py",resultdir/"zipformer.json",resultdir/"sensevoice.json"],root)
        (resultdir/"score.txt").write_text(summary+"\n",encoding="utf-8")
        checks={n:digest(resultdir/(n+".json")) for n in MODELS}
        (resultdir/"campaign-summary.json").write_text(json.dumps({"fixture_revision":FIXTURES_SHA,"checksums":checks},indent=2)+"\n",encoding="utf-8")
        command(["git","add","--","research/human-asr-benchmark/results"],root)
        staged=command(["git","diff","--cached","--name-only"],root).splitlines()
        if not staged or any(not f.startswith("research/human-asr-benchmark/results/") for f in staged):raise RuntimeError("Unexpected stage paths")
        command(["git","commit","-m","test(asr): benchmark approved owner WAV corpus"],root)
        revision=command(["git","rev-parse","HEAD"],root);receipt("committed_local",revision=revision)
        command(["git","push","origin","HEAD:refs/heads/"+BRANCH],root)
        remote=command(["git","ls-remote","origin","refs/heads/"+BRANCH],root).split()[0]
        if remote!=revision:raise RuntimeError("Remote revision mismatch")
        receipt("pushed_verified",revision=revision,results=str(resultdir))
    except Exception as e:
        receipt("blocked",error=str(e));raise
def main():
    if len(sys.argv)!=2 or sys.argv[1] not in ("doctor","run","status"):raise SystemExit("Usage: python campaigns/run_human_asr.py doctor|run|status")
    if sys.argv[1]=="status":
        p=BASE/"status.json";print(p.read_text(encoding="utf-8") if p.exists() else "No campaign receipt")
    elif sys.argv[1]=="doctor":doctor()
    else:execute()
if __name__=="__main__":
    try:main()
    except Exception as e:print("CAMPAIGN_FAILED",str(e),file=sys.stderr);sys.exit(1)
