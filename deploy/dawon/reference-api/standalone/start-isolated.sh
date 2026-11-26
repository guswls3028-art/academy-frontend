#!/usr/bin/env bash
set -euo pipefail
umask 077
root=/opt/dawon-review
marker_ref=${1:?sealed source digest required}
[[ "$marker_ref" =~ ^[a-f0-9]{64}$ ]]
stage="$root/reference-r49-standalone-${marker_ref:0:12}"
cd "$stage"
test "$(cat .package-sha)" = "$marker_ref"
sha256sum -c --quiet SHA256SUMS
label="hakwonplus.reference.r49=$marker_ref"
api=review-api-r49
db=review-reference-r49-db
cache=review-reference-r49-cache
net=review-reference-r49-internal
volume=review-reference-r49-db-data
expected_image=sha256:689551c1da73af1d35eb116acd84de6cff3306832710e2eef645f13ebc9095d5
legacy_db=review-db

bash "$root/staff-r47-admin-qa/check-capacity.sh"
test "$(docker inspect -f '{{.State.Running}}' review-api-r37)" = false
test "$(docker inspect -f '{{.Image}} {{.State.Running}}' review-api-r47)" = "$expected_image true"
for item in "$api" "$db" "$cache"; do ! docker inspect "$item" >/dev/null 2>&1; done
! docker network inspect "$net" >/dev/null 2>&1
! docker volume inspect "$volume" >/dev/null 2>&1
test ! -e private.env && test ! -e postgres.env
rollback_new() {
  local status=$?
  if [ "$status" -ne 0 ]; then
    for item in "$api" "$cache" "$db"; do
      if docker inspect "$item" >/dev/null 2>&1; then
        test "$(docker inspect -f '{{index .Config.Labels "hakwonplus.reference.r49"}}' "$item")" = "$marker_ref"
        docker rm -fv "$item" >/dev/null
      fi
    done
    if docker network inspect "$net" >/dev/null 2>&1; then
      test "$(docker network inspect -f '{{index .Labels "hakwonplus.reference.r49"}}' "$net")" = "$marker_ref"
      docker network rm "$net" >/dev/null
    fi
    if docker volume inspect "$volume" >/dev/null 2>&1; then
      test "$(docker volume inspect -f '{{index .Labels "hakwonplus.reference.r49"}}' "$volume")" = "$marker_ref"
      docker volume rm "$volume" >/dev/null
    fi
    if [ -f private.env ] && [ ! -L private.env ]; then rm -- private.env; fi
    if [ -f postgres.env ] && [ ! -L postgres.env ]; then rm -- postgres.env; fi
    echo 'Failed isolated stage removed only its newly created resources.'
  fi
  exit "$status"
}
trap rollback_new EXIT
db_image=$(docker inspect -f '{{.Image}}' "$legacy_db")
cache_image=$(docker inspect -f '{{.Image}}' review-redis)
db_mount=$(docker image inspect -f '{{range $path,$v := .Config.Volumes}}{{$path}}{{end}}' "$db_image")
case "$db_mount" in /var/lib/postgresql|/var/lib/postgresql/data) ;; *) echo 'Unexpected PG volume path';exit 1;;esac
python3 - <<'PY'
from pathlib import Path
from secrets import token_hex
p=Path("private.env")
values=dict(POSTGRES_USER="reference",POSTGRES_DB="qa_hakwonplus_reference",
  DB_USER="reference",DB_HOST="comparison-db",TEST_DB_NAME="qa_hakwonplus_reference",
  DJANGO_SETTINGS_MODULE="reference_settings",HAKWONPLUS_COMPARISON_BOUNDARY="isolated-reference-849",
  PYTHONPATH="/reference:/app",PYTHONDONTWRITEBYTECODE="1",
  AWS_EC2_METADATA_DISABLED="true",AWS_DEFAULT_REGION="us-east-1",AWS_REGION="us-east-1",
  AWS_ACCESS_KEY_ID="synthetic-isolated-reference",AWS_SECRET_ACCESS_KEY="synthetic-isolated-pointless",
  AWS_ENDPOINT_URL="http://comparison-disabled.invalid",AWS_ENDPOINT_URL_SQS="http://comparison-disabled.invalid",
  COMPARISON_ADMIN_PASSWORD=token_hex(32),COMPARISON_SIGNING_KEY=token_hex(48))
values["DB_PASSWORD"]=token_hex(32)
pg=dict(POSTGRES_DB=values.pop("POSTGRES_DB"),POSTGRES_USER=values.pop("POSTGRES_USER"),POSTGRES_PASSWORD=values["DB_PASSWORD"])
with Path("postgres.env").open("x") as file:
  file.writelines(f"{key}={value}\n" for key,value in pg.items())
with p.open("x") as file:
  file.writelines(f"{key}={value}\n" for key,value in values.items())
PY
test "$(stat -c %a private.env)" = 600
docker network create --internal --label "$label" "$net" >/dev/null
docker volume create --label "$label" "$volume" >/dev/null
docker run -d --name "$db" --label "$label" --network "$net" --network-alias comparison-db \
    --env-file postgres.env --memory 384m --tmpfs /tmp --mount "type=volume,src=$volume,dst=$db_mount" "$db_image" >/dev/null
docker run -d --name "$cache" --label "$label" --network "$net" --network-alias comparison-cache \
    --memory 128m --tmpfs /data "$cache_image" redis-server --save '' --appendonly no >/dev/null
for i in $(seq 1 45); do
  if docker exec "$db" pg_isready -U reference -d qa_hakwonplus_reference >/dev/null 2>&1; then break; fi
  sleep 2
done
docker exec "$db" pg_isready -U reference -d qa_hakwonplus_reference >/dev/null
chmod -R a+rX app
run=(--label "$label" --network "$net" --env-file private.env -v "$stage/app:/reference:ro" --read-only --memory 768m --tmpfs /tmp:rw,nosuid,size=96m)
docker run --rm "${run[@]}" "$expected_image" python -m django migrate --noinput --verbosity 0
docker run --rm "${run[@]}" "$expected_image" python -m django migrate --check --noinput
docker run --rm "${run[@]}" "$expected_image" python -B /reference/seed.py
docker run --rm "${run[@]}" "$expected_image" python -B /reference/seed.py
docker run -d --name "$api" "${run[@]}" "$expected_image" gunicorn --bind 0.0.0.0:8000 \
    --worker-class gthread --workers 1 --threads 3 --timeout 70 apps.api.config.wsgi:application >/dev/null
for i in $(seq 1 30); do
  if docker exec "$api" python -c 'import urllib.request; assert urllib.request.urlopen("http://localhost:8000/healthz",timeout=3).status==200' >/dev/null 2>&1; then break; fi
  sleep 2
done
docker exec "$api" python -c 'import urllib.request; assert urllib.request.urlopen("http://localhost:8000/healthz",timeout=3).status==200'
test "$(docker network inspect -f '{{.Internal}} {{len .Containers}}' "$net")" = "true 3"
test "$(docker inspect -f '{{len .NetworkSettings.Networks}} {{.HostConfig.ReadonlyRootfs}}' "$api")" = "1 true"
test "$(docker inspect -f '{{len .HostConfig.PortBindings}}' "$api")" = "0"
docker exec "$api" python -B /reference/runtime-proof.py
trap - EXIT
printf 'Reference API private stage complete: %s (%s), one independent DB/cache network.\n' "$api" "$marker_ref"