#!/usr/bin/env bash
set -euo pipefail
umask 077
mode=${1:?validate, apply, or rollback}
package=${2:?expected standalone package SHA}
[[ $package =~ ^[a-f0-9]{64}$ ]]
root=/opt/dawon-review
stage="$root/reference-r49-standalone-${package:0:12}"
before="$stage/origin-before.Caddyfile"
after="$stage/origin-after.Caddyfile"
active="$root/origin.Caddyfile"
pending="$root/origin.reference-r49-standalone.next"
net=review-reference-r49-internal
expected=c1cbdaf9190892881ad3c220a2e5858e7f64b25e2ab31d90b6da191969c6378f
cd "$stage"
test "$(cat .package-sha)" = "$package"
sha256sum -c --quiet SHA256SUMS
hash(){ sha256sum "$1" | cut -d' ' -f1; }
verify() {
  for c in review-api-r38 review-api-r47 review-api-r49; do
    docker exec "$c" python -c 'import urllib.request; assert urllib.request.urlopen("http://localhost:8000/healthz",timeout=4).status==200' || return 1
  done
  test "$(docker inspect -f '{{.State.Running}}' review-api-r37)" = false
}
validate(){ docker exec -i review-origin caddy validate --config /dev/stdin --adapter caddyfile <"$1" >/dev/null; }
change(){
  test ! -e "$pending" || return 1
  install -m 0444 "$1" "$pending" || return 1
  mv "$pending" "$active" || return 1
  docker restart review-origin >/dev/null || return 1
  docker exec review-origin caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
}
contained(){
  test "$(docker network inspect -f '{{.Internal}}' "$net")" = true
  test "$(docker inspect -f '{{index .Config.Labels "hakwonplus.reference.r49"}}' review-api-r49)" = "$package"
  test "$(docker inspect -f '{{len .NetworkSettings.Networks}}' review-api-r49)" = 1
}
contains_origin(){
  docker network inspect -f '{{range .Containers}}{{.Name}}{{println}}{{end}}' "$net" | grep -Fxq review-origin
}
verify
contained
case "$mode" in
  validate)
    test "$(hash "$active")" = "$expected"
    ! contains_origin
    test ! -e "$before" && test ! -e "$after" && test ! -e "$pending"
    cp "$active" "$before"
    python3 - "$before" "$after" reference.Caddyfile <<'PY'
import re
import sys
from pathlib import Path
source,dest,frag=map(Path,sys.argv[1:])
old=source.read_bytes()
new_fragment=frag.read_bytes().rstrip()+b"\n\n"
assert b"standalone_reference_r49" not in old and b"/__reference" not in old
anchor,=re.finditer(rb'(?m)^([ \t]*)handle @authorized \{(?:\r)?$',old)
line=b"\n"+anchor[1]+b"    import standalone_reference_r49"
new=new_fragment+old[:anchor.end()]+line+old[anchor.end():]
assert new[len(new_fragment):].replace(line,b"",1)==old
dest.write_bytes(new)
PY
    validate "$after"
    printf 'Production-origin candidate validated; retained=%s proposed=%s\n' "$(hash "$before")" "$(hash "$after")"
    ;;
  apply)
    test "$(hash "$active")" = "$expected" && test "$(hash "$before")" = "$expected"
    ! contains_origin
    validate "$after"
    docker network connect "$net" review-origin
    recover(){
      local status=$?
      if [ "$status" -ne 0 ]; then
        if [ "$(hash "$active")" = "$(hash "$after")" ]; then change "$before"; fi
        if contains_origin; then docker network disconnect "$net" review-origin; fi
        test "$(hash "$active")" = "$expected"
      fi
      exit "$status"
    }
    trap recover EXIT
    change "$after"
    verify
    test "$(hash "$active")" = "$(hash "$after")"
    test "$(docker network inspect -f '{{len .Containers}}' "$net")" = 4
    trap - EXIT
    printf 'Protected reference route applied; config=%s\n' "$(hash "$active")"
    ;;
  rollback)
    test "$(hash "$before")" = "$expected" && test "$(hash "$active")" = "$(hash "$after")"
    change "$before"
    docker network disconnect "$net" review-origin
    test "$(hash "$active")" = "$expected"
    verify
    echo 'Protected comparison route rolled back; independent sample DB and assets retained.'
    ;;
  *) exit 2 ;;
esac