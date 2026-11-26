#!/usr/bin/env bash
set -euo pipefail
umask 077
new=${1:?new exact package}
old=${2:?old exact package}
[[ $new =~ ^[a-f0-9]{64}$ && $old =~ ^[a-f0-9]{64}$ && $new != "$old" ]]
root=/opt/dawon-review
stage="$root/reference-r49-standalone-${new:0:12}"
existing="$root/reference-r49-standalone-${old:0:12}"
credential_revision=${3:-$old}
[[ $credential_revision =~ ^[a-f0-9]{64}$ ]]
credential_stage="$root/reference-r49-standalone-${credential_revision:0:12}"
current=review-api-r49
archived="review-api-r49-unpublished-${old:0:12}"
net=review-reference-r49-internal
image=sha256:689551c1da73af1d35eb116acd84de6cff3306832710e2eef645f13ebc9095d5
cd "$stage"
test "$(cat .package-sha)" = "$new"
test "$(cat "$existing/.package-sha")" = "$old"
test "$(cat "$credential_stage/.package-sha")" = "$credential_revision"
sha256sum -c --quiet SHA256SUMS
test "$(docker network inspect -f '{{.Internal}}' "$net")" = true
case "$(docker network inspect -f '{{range .Containers}}{{println .Name}}{{end}}' "$net" | awk 'NF' | sort | paste -sd,)" in
  review-api-r49,review-reference-r49-cache,review-reference-r49-db|review-api-r49,review-origin,review-reference-r49-cache,review-reference-r49-db) ;;
  *) echo 'Unexpected comparison peers'; exit 1;;
esac
test "$(docker inspect -f '{{index .Config.Labels "hakwonplus.reference.r49"}} {{.Image}} {{.State.Running}}' "$current")" = "$old $image true"
test ! -L "$credential_stage/private.env" && test "$(stat -c %a "$credential_stage/private.env")" = 600
! docker inspect "$archived" >/dev/null 2>&1
chmod -R a+rX app backend-patch
source ./board-layer.sh
reference_board_mounts "$stage"
run=(--network "$net" --env-file "$credential_stage/private.env" -v "$stage/app:/reference:ro" --read-only --memory 768m --tmpfs /tmp:rw,nosuid,size=96m "${board_mounts[@]}")
docker run --rm "${run[@]}" "$image" gunicorn --check-config apps.api.config.wsgi:application
reference_board_migrate "${run[@]}" "$image"
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
docker exec "$current" python -B /reference/board-proof.py
if [ -f "$existing/origin-before.Caddyfile" ]; then
  test -f "$existing/origin-after.Caddyfile"
  cmp "$existing/origin-after.Caddyfile" "$root/origin.Caddyfile"
  cp -p "$existing/origin-before.Caddyfile" "$existing/origin-after.Caddyfile" .
fi
trap - EXIT
test "$(docker inspect -f '{{index .Config.Labels "hakwonplus.reference.r49"}} {{.State.Running}}' "$archived")" = "$old false"
docker rm "$archived" >/dev/null
test "$(docker network inspect -f '{{.Internal}}' "$net")" = true
case "$(docker network inspect -f '{{range .Containers}}{{println .Name}}{{end}}' "$net" | awk 'NF' | sort | paste -sd,)" in
  review-api-r49,review-reference-r49-cache,review-reference-r49-db|review-api-r49,review-origin,review-reference-r49-cache,review-reference-r49-db) ;;
  *) echo 'Unexpected comparison peers'; exit 1;;
esac
echo 'Final API package verified. Existing PostgreSQL/cache/credentials retained; old private API process retired.'