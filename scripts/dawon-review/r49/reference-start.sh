#!/usr/bin/env bash
set -euo pipefail
test -n "${RUNNER_TEMP:-}"
backend="$GITHUB_WORKSPACE/backend"
code="$GITHUB_WORKSPACE/worker-source/deploy/dawon/reference-api/standalone"
export PYTHONPATH="$code:$backend"
export DJANGO_SETTINGS_MODULE=reference_settings HAKWONPLUS_COMPARISON_BOUNDARY=isolated-reference-849
export DB_HOST=comparison-db DB_USER=reference_qa DB_PASSWORD=fixture-reference-db TEST_DB_NAME=qa_hakwonplus_reference
export COMPARISON_SIGNING_KEY="$(openssl rand -hex 48)" COMPARISON_ADMIN_PASSWORD="$(openssl rand -hex 32)"
export AWS_EC2_METADATA_DISABLED=true AWS_REGION=us-east-1 AWS_DEFAULT_REGION=us-east-1
export TENANT_OWNER_INITIAL_PASSWORD="$(openssl rand -hex 24)"
export REDIS_HOST=comparison-cache REDIS_PORT=6379
cd "$backend"
python -m django migrate --noinput --verbosity=0
python -m django migrate --check
python "$code/seed.py"
python -m django runserver 127.0.0.1:18849 --noreload >"$RUNNER_TEMP/isolated-reference.log" 2>&1 &
curl -fsS --retry 20 --retry-delay 1 --retry-connrefused --max-time 8 -H 'Host: reference.hakwonplus.localhost' http://127.0.0.1:18849/healthz >/dev/null
