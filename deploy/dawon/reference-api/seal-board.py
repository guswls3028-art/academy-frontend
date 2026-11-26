"""Seal the official board overlay and transfer it as bounded verified SSM fragments."""
import base64
import gzip
import hashlib
import io
import json
from pathlib import Path
import tarfile

ROOT=Path(__file__).resolve().parent
SOURCE=ROOT/"standalone"
OLD="d2b382d2512308f447f39853197730222a2a823fac9d02aaef6d7021d7d881d4"
CREDENTIALS="12dcb1f1734da315f1418cef93d53811ebb73805dc75f57706900a8480bb0458"
IMAGE="sha256:689551c1da73af1d35eb116acd84de6cff3306832710e2eef645f13ebc9095d5"
overlay=json.loads((SOURCE/"board-source.json").read_text())
def sha(data):
    return hashlib.sha256(data).hexdigest()

files={}
for name in ("reference_settings.py","reference_urls.py","reference_session.py","reference_boundary.py","seed.py","runtime-proof.py","seed-board.py","board-proof.py"):
    files["app/"+name]=(SOURCE/name).read_bytes().replace(b"\r\n",b"\n")
for name in ("start-isolated.sh","upgrade-isolated.sh","mount-protected.sh","reference.Caddyfile","board-layer.sh","board-source.json"):
    files[name]=(SOURCE/name).read_bytes().replace(b"\r\n",b"\n")
for name,info in overlay["overlayFiles"].items():
    key="backend-patch/"+name
    files[key]=(SOURCE/key).read_bytes()
    assert sha(files[key])==info["sha256"]
hashes={name:sha(data) for name,data in sorted(files.items())}
files["SHA256SUMS"]="".join(f"{value}  {name}\n" for name,value in hashes.items()).encode()
box=io.BytesIO()
with gzip.GzipFile(fileobj=box,mode="wb",compresslevel=7,mtime=0) as gz:
    with tarfile.open(fileobj=gz,mode="w") as tar:
        for name,data in sorted(files.items()):
            item=tarfile.TarInfo(name);item.size=len(data);item.mode=0o644
            tar.addfile(item,io.BytesIO(data))
archive=box.getvalue()
identity=sha(archive)
stage="/opt/dawon-review/reference-r49-standalone-"+identity[:12]
(ROOT/f"reference-board-{identity}.tar.gz").write_bytes(archive)
parts=[]
for offset in range(0,len(archive),7500):
    part=archive[offset:offset+7500]
    name=f"refboard-part-{len(parts):02}"
    init=f"test ! -e '{stage}'\nmkdir -m 0700 '{stage}'\nprintf '%s' '{identity}' > '{stage}/.package-sha'\n" if not parts else ""
    cmd=f"""set -euo pipefail
umask 077
{init}cd '{stage}'
test "$(cat .package-sha)" = '{identity}'
test ! -e '{name}'
printf '%s' '{base64.b64encode(part).decode()}' | base64 -d > '{name}'
echo '{sha(part)}  {name}' | sha256sum -c --quiet -
echo '{name} verified'
"""
    (ROOT/(name+".sh")).write_text(cmd,encoding="utf-8",newline="\n")
    parts.append(name)
part_args=" ".join(parts)
upgrade=f"""set -euo pipefail
umask 077
cd '{stage}'
test "$(cat .package-sha)" = '{identity}'
cat {part_args} > reference-standalone.tar.gz
echo '{identity}  reference-standalone.tar.gz' | sha256sum -c --quiet -
tar --no-same-owner -xzf reference-standalone.tar.gz
sha256sum -c --quiet SHA256SUMS
rm -- {part_args}
bash upgrade-isolated.sh '{identity}' '{OLD}' '{CREDENTIALS}'
"""
(ROOT/"upgrade-reference-board.sh").write_text(upgrade,encoding="utf-8",newline="\n")
record={"packageSha256":identity,"stage":stage,"bytes":len(archive),"files":hashes,"transferParts":parts,
        "image":IMAGE,"base":overlay["base"],"productionBoardSource":overlay["productionBoardSource"],"previousPackage":OLD}
(ROOT/"standalone-board-manifest.json").write_text(json.dumps(record,indent=2)+"\n",encoding="utf-8")
print(json.dumps(record))