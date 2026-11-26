# Bind the independently sealed official board overlay without changing the native image.
reference_board_mounts() {
  local source_stage=$1 item path
  board_mounts=()
  while IFS= read -r -d '' item; do
    path=${item#"$source_stage/backend-patch/"}
    [[ $path =~ ^apps/[a-zA-Z0-9_/]+\.py$ ]] || return 1
    board_mounts+=(-v "$item:/app/$path:ro")
  done < <(find "$source_stage/backend-patch/apps" -type f -print0)
  test "${#board_mounts[@]}" -eq 18
}

reference_board_migrate() {
  # The native base may be rolled back with these additive tables left intact.
  docker run --rm -i "$@" python - <<'PY'
import django
django.setup()
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
executor=MigrationExecutor(connection)
plan=executor.migration_plan(executor.loader.graph.leaf_nodes())
assert all(m.app_label=="staffs" and m.name in {"0011_staffboardpost_staffboardreply_and_more","0012_staffboardwritereceipt"} and not backwards for m,backwards in plan)
print("allowed_board_migration_count="+str(len(plan)))
PY
  docker run --rm "$@" python -m django migrate staffs --noinput --verbosity 1
  docker run --rm "$@" python -m django migrate --check --noinput
  docker run --rm "$@" python -B /reference/seed-board.py
}