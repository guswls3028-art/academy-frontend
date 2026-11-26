"""Resolve official build identities and extract only sealed runtime files."""
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import zipfile

ROOT=Path(__file__).resolve().parent
WORKSPACE=Path(os.environ["GITHUB_WORKSPACE"])
TEMP=Path(os.environ["RUNNER_TEMP"])
REPO="guswls3028-art/academy-frontend"
target=json.loads((ROOT/"target.json").read_text())

def gh_api(path):
    return json.loads(subprocess.check_output(["gh","api",f"repos/{REPO}/{path}"]))

def digest(path):
    with path.open("rb") as f:
        return hashlib.file_digest(f,"sha256").hexdigest()

def acquire(frontend,run,out,pin=None):
    info=gh_api(f"actions/runs/{run}")
    assert info["head_sha"]==frontend and info["event"]=="workflow_dispatch"
    assert info["status"]=="completed" and info["conclusion"]=="success"
    choices=[a for a in gh_api(f"actions/runs/{run}/artifacts")["artifacts"]
             if a["name"]=="deploy-bundle" and not a["expired"]]
    assert len(choices)==1
    item=choices[0]
    assert item["workflow_run"]["head_sha"]==frontend and item["workflow_run"]["id"]==run
    claimed=item["digest"].removeprefix("sha256:")
    assert re.fullmatch("[0-9a-f]{64}",claimed)
    if pin:
        assert item["id"]==pin["artifact_id"] and claimed==pin["artifact_sha256"]
    archive=TEMP/(out+".zip")
    with archive.open("wb") as f:
        subprocess.run(["gh","api",f"repos/{REPO}/actions/artifacts/{item['id']}/zip"],stdout=f,check=True)
    assert archive.stat().st_size==item["size_in_bytes"] and digest(archive)==claimed
    root=WORKSPACE/out
    paths=set()
    with zipfile.ZipFile(archive) as z:
        for entry in z.infolist():
            parts=PurePosixPath(entry.filename).parts
            if entry.is_dir() or not parts or parts[0]!="dist":
                continue
            assert ".." not in parts and chr(92) not in entry.filename and ":" not in entry.filename
            assert entry.filename not in paths
            paths.add(entry.filename)
            file=root.joinpath(*parts)
            file.parent.mkdir(parents=True,exist_ok=True)
            file.write_bytes(z.read(entry))
    index=root/"dist/index.html"
    entry=re.search(rb'<script[^>]+type="module"[^>]+src="(/assets/index-[A-Za-z0-9_-]+\.js)"',index.read_bytes())[1].decode()
    return {"source":frontend,"run":run,"artifactId":item["id"],"artifactSha256":claimed,
            "indexSha256":digest(index),"entry":entry,
            "version":json.loads((root/"dist/version.json").read_text())["version"]}

phase=sys.argv[1]
assert phase in ("private","stage","live")
assert target["phase"]==phase
original=acquire(target["originalFrontend"],target["originalRun"],"reference-compiled")
dawon=acquire(target["dawonFrontend"],target["dawonRun"],"compiled",
              json.loads((ROOT/"r48-pins.json").read_text()))
assert dawon["version"]==target["adminVersion"]
assert original["version"]==target["originalFrontend"]
assert original["entry"]!=dawon["entry"]
receipt={"original":original,"dawon":dawon,"worker":target["workerSource"],"backend":target["backend"]}
(ROOT/"sealed-builds.json").write_text(json.dumps(receipt,indent=2)+"\n")
print(json.dumps(receipt))
