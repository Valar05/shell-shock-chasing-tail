#!/usr/bin/env python3
"""Shell Shock exact-byte Drive ZIP import. Run in an isolated Git worktree; not an installer."""
import argparse, hashlib, json, pathlib, subprocess, time, zipfile
P=pathlib.Path
ZIP_SHA="571c9a1195e0296715654f1f3a1a19785a0e52ab59cbb3e1f1d7ded6146090c1"
PREFIX="shellshock-human-asr-benchmark/"
DEST=P("research/human-asr-benchmark")
def git(*args):
    return subprocess.check_output(["git",*args],text=True).strip()
def digest(data):return hashlib.sha256(data).hexdigest()
def main():
    a=argparse.ArgumentParser();a.add_argument("--archive",required=True);a.add_argument("--commit",action="store_true");q=a.parse_args()
    archive=P(q.archive);receipt=DEST/"import-receipt.json"
    assert git("status","--porcelain")== "", "Refusing dirty checkout"
    assert git("branch","--show-current")=="campaign/human-voice-fixtures-20261025","Wrong branch"
    assert digest(archive.read_bytes())==ZIP_SHA, "ZIP byte hash mismatch"
    original=git("rev-parse","HEAD")
    with zipfile.ZipFile(archive) as z:
        manifest=json.loads(z.read(PREFIX+"manifest.json"))
        for case in manifest["cases"]:
            path=P(case["file"])
            assert path.parts[0]=="fixtures" and len(path.parts)==2,"Unexpected destination"
            b=z.read(PREFIX+str(path).replace("\\","/"))
            assert digest(b)==case["sha256"], "WAV checksum mismatch "+str(path)
            dest=DEST/path;dest.parent.mkdir(parents=True,exist_ok=True)
            if dest.exists():assert dest.read_bytes()==b,"Existing differing fixture";continue
            dest.write_bytes(b)
        # Keep the upstream metadata and scripts as supplied.
        for name in ["manifest.json","README.md","score.py","benchmark.py"]:
            b=z.read(PREFIX+name);p=DEST/name
            if p.exists():assert p.read_bytes()==b,"Existing differing companion file";continue
            p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
    records={str(p.relative_to(DEST)):digest(p.read_bytes()) for p in sorted(DEST.rglob("*")) if p.is_file() and p!=receipt}
    obj={"campaign":"shellshock-human-voice-fixtures-20261025","stage":"import_verified","source_sha":original,"zip_sha256":ZIP_SHA,"files":records,"timestamp_utc":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime())}
    receipt.write_text(json.dumps(obj,indent=2)+"\n")
    if q.commit:
        subprocess.run(["git","add","--",str(DEST)],check=True)
        subprocess.run(["git","commit","-m","test(asr): import approved owner voice WAV fixtures and receipt"],check=True)
        subprocess.run(["git","push","origin","HEAD:refs/heads/campaign/human-voice-fixtures-20261025"],check=True)
        obj["commit_sha"]=git("rev-parse","HEAD")
    print(json.dumps(obj,indent=2))
if __name__=="__main__":main()
