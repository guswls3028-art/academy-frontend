"""Seal only source files and transfer verified bytes, never credentials."""
from pathlib import Path
import argparse
import base64
import hashlib
import io
import json
import re
import tarfile

ROOT=Path(__file__).resolve().parent
SRC=ROOT/"standalone"
APPS=("reference_settings.py","reference_urls.py","reference_session.py","reference_boundary.py","seed.py","runtime-proof.py")
SHELLS=("start-isolated.sh","upgrade-isolated.sh","mount-protected.sh","reference.Caddyfile")
def sha(data):
    return hashlib.sha256(data).hexdigest()

def write_tar(files,path):
    with tarfile.open(path,"w:gz",compresslevel=6) as archive:
        for name,data in sorted(files.items()):
            item=tarfile.TarInfo(name)
            item.size=len(data);item.mode=0o644
            archive.addfile(item,io.BytesIO(data))

parser=argparse.ArgumentParser()
parser.add_argument("--previous")
previous=parser.parse_args().previous
assert not previous or re.fullmatch(r"[a-f0-9]{64}",previous)
files={f"app/{name}":(SRC/name).read_bytes().replace(b"\r\n",b"\n") for name in APPS}
files.update({name:(SRC/name).read_bytes().replace(b"\r\n",b"\n") for name in SHELLS})
sums={name:sha(data) for name,data in sorted(files.items())}
files["SHA256SUMS"]="".join(f"{digest}  {name}\n" for name,digest in sums.items()).encode()
archive=ROOT/"reference-standalone.tar.gz"
write_tar(files,archive)
contents=archive.read_bytes()
digest=sha(contents)
stage="/opt/dawon-review/reference-r49-standalone-"+digest[:12]
packing=base64.b64encode(contents).decode()
assert len(packing)<18000
launch=f"bash upgrade-isolated.sh '{digest}' '{previous}'" if previous else f"bash start-isolated.sh '{digest}'"
script=f"""set -euo pipefail
umask 077
stage='{stage}'
sha='{digest}'
test ! -e "$stage"
mkdir -m 0700 "$stage"
cd "$stage"
printf '%s' '{packing}' | base64 -d > reference-standalone.tar.gz
echo "$sha  reference-standalone.tar.gz" | sha256sum -c --quiet -
printf '%s' "$sha" > .package-sha
tar --no-same-owner -xzf reference-standalone.tar.gz
sha256sum -c --quiet SHA256SUMS
{launch}
"""
(ROOT/"start-reference-standalone.sh").write_text(script,encoding="utf-8",newline="\n")
record={"packageSha256":digest,"bytes":len(contents),"stage":stage,"files":sums,
        "image":"sha256:689551c1da73af1d35eb116acd84de6cff3306832710e2eef645f13ebc9095d5",
        "backend":"2684bbba5cb5760acbdfb02cc7b09ad7a8d46f34"}
(ROOT/"standalone-manifest.json").write_text(json.dumps(record,indent=2)+"\n",encoding="utf-8")
print(json.dumps(record))