#!/usr/bin/env bash
set -euo pipefail
umask 077
new=${1:?new exact package}
old=${2:?old exact package}
[[ $new =~ ^[a-f0-9]{64}$ && $old =~ ^[a-f0-9]{64}$ && $new != "$old" ]]
root=/opt/dawon-review
stage="$root/reference-r49-standalone-${new:0:12}"
existing="$root/reference-r49-standalone-${old:0:12}"
current=review-api-r49
archived="review-api-r49-unpublished-${old:0:12}"
net=review-reference-r49-internal
image=sha256:689551c1da73af1d35eb116acd84de6cff3306832710e2eef645f13ebc9095d5
cd "$stage"
test "$(cat .package-sha)" = "$new"
test "$(cat "$existing/.package-sha")" = "$old"
sha256sum -c --quiet SHA256SUMS
test "$(docker network inspect -f '{{.Internal}} {{len .Containers}}' "$net")" = 'true 3'
test "$(docker inspect -f '{{index .Config.Labels "hakwonplus.reference.r49"}} {{.Image}} {{.State.Running}}' "$current")" = "$old $image true"
test ! -L "$existing/private.env" && test "$(stat -c %a "$existing/private.env")" = 600
! docker inspect "$archived" >/dev/null 2>&1
chmod -R a+rX app
run=(--network "$net" --env-file "$existing/private.env" -v "$stage/app:/reference:ro" --read-only --memory 768m --tmpfs /tmp:rw,nosuid,size=96m)
docker run --rm "${run[@]}" "$image" gunicorn --check-config apps.api.config.wsgi:application
docker stop --time 30 "$current" >/dev/null
docker rename "$current" "$archived"
recover() {
  code=$?
  if [ "$code" -ne 0 ]; then
    if docker inspect "$current" >/dev/null 2>&1; then
      test "$(docker inspect -f '{{index .Config.Labels "hakwonplus.reference.r49"}}' "$current")" = "$new"
      docker rm -fv "$current" >/dev/null
    fi
    docker rename "$archived" "$current"
    docker start "$current" >/dev/null
  fi
  exit "$code"
}
trap recover EXIT
bash "$root/staff-r47-admin-qa/check-capacity.sh"
docker run -d --name "$current" --label "hakwonplus.reference.r49=$new" "${run[@]}" "$image" \
  gunicorn --bind 0.0.0.0:8000 --worker-class gthread --workers 1 --threads 3 --timeout 70 apps.api.config.wsgi:application >/dev/null
for i in $(seq 1 35); do
  if docker exec "$current" python -c 'import urllib.request; assert urllib.request.urlopen("http://localhost:8000/healthz",timeout=3).status==200' >/dev/null 2>&1; then break; fi
  sleep 2
done
docker exec "$current" python -B /reference/runtime-proof.py
trap - EXIT
test "$(docker inspect -f '{{index .Config.Labels "hakwonplus.reference.r49"}} {{.State.Running}}' "$archived")" = "$old false"
docker rm "$archived" >/dev/null
test "$(docker network inspect -f '{{.Internal}} {{len .Containers}}' "$net")" = 'true 3'
echo 'Final API package verified. Existing PostgreSQL/cache/credentials retained; old private API process retired.'