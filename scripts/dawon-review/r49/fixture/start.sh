set -euo pipefail
fixture=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo=${GITHUB_WORKSPACE:-$(pwd)}
backend="$repo/backend"
expected=2684bbba5cb5760acbdfb02cc7b09ad7a8d46f34
test "$(git -C "$backend" rev-parse HEAD)" = "$expected"
test -n "${RUNNER_TEMP:-}"
export R47_QA_HOSTED=1
export DJANGO_SETTINGS_MODULE=r47_fixture_settings
export PYTHONPATH="$fixture:$backend"
export DB_HOST=qa-r47-db DB_USER="${R47_QA_DB_USER:-dawon}"
export DB_PASSWORD="${R47_QA_DB_PASSWORD:-dawon-r47-local-postgres}" TEST_DB_NAME=qa_r47
export AWS_REGION=us-east-1 AWS_DEFAULT_REGION=us-east-1 AWS_EC2_METADATA_DISABLED=true
export AWS_ENDPOINT_URL=http://review-moto:5000 AWS_ENDPOINT_URL_SQS=http://review-moto:5000
export AWS_ACCESS_KEY_ID=synthetic-emulator-access AWS_SECRET_ACCESS_KEY=synthetic-emulator-secret
export TOOLS_SQS_QUEUE_NAME=dawon-review-tools REDIS_HOST=review-redis REDIS_PORT=6379
export AI_WORKER_IDLE_SCALE_IN_ENABLED=0 TENANT_OWNER_INITIAL_PASSWORD=FixtureOnly-R47-Owner-123
export NO_PROXY="127.0.0.1,localhost,review-moto,qa-r47-db,review-redis"
state="$RUNNER_TEMP/dawon-r47-fixture"
mkdir -- "$state"
cd -- "$backend"
api_pid=
worker_pid=
cleanup_on_failure() {
  local status=$?
  if [[ $status -ne 0 ]]; then
    tail -n 35 "$state/api.log" "$state/tools.log" 2>/dev/null || true
    if [[ -n $api_pid ]]; then kill "$api_pid" 2>/dev/null || true; fi
    if [[ -n $worker_pid ]]; then kill "$worker_pid" 2>/dev/null || true; fi
  fi
}
trap cleanup_on_failure EXIT
python -m django migrate --noinput --verbosity 0
python -m django migrate --check --noinput
python -m django provision_tenant dawon --tenant-id 719 --name '다원수학 QA' --domain dawon.localhost --owner-username qa-r47-owner --owner-name 'QA R47' --login-title 'QA R47' --primary-color '#e46a1f' >/dev/null
python "$fixture/seed.py"
python "$fixture/ensure-demo-excel.py"
python -m apps.worker.tools_worker.sqs_main >"$state/tools.log" 2>&1 &
worker_pid=$!
python -m django runserver 127.0.0.1:18847 --noreload >"$state/api.log" 2>&1 &
api_pid=$!
for i in $(seq 1 30); do
  kill -0 "$api_pid" "$worker_pid"
  if curl --silent --fail --max-time 2 http://127.0.0.1:18847/healthz >/dev/null; then
    curl --silent --show-error --fail --max-time 10 \
      -H 'Host: dawon.localhost' -H 'X-Forwarded-Host: dawon.localhost' -H 'X-Tenant-Code: dawon' \
      -H 'Content-Type: application/json' --data '{"role":"admin"}' \
      http://127.0.0.1:18847/api/v1/students/demo-session/ |
      python -c 'import json,sys; payload=json.load(sys.stdin); assert payload.get("access") and payload.get("refresh")'
    printf '%s\n%s\n' "$api_pid" "$worker_pid" >"$state/pids"
    echo 'Verified R47 fixture API and admin auth at 127.0.0.1:18847'
    exit 0
  fi
  sleep 2
done
echo 'R47 fixture failed readiness' >&2
exit 1