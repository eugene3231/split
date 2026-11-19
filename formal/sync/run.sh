#!/usr/bin/env bash
# Model-checks the group sync engine (formal/sync/SyncEngine.tla). `pnpm formal:sync` runs it.
#   formal/sync/run.sh                 the code, in all three models: every property must hold
#   formal/sync/run.sh <variant>       one deliberately broken variant: its property must fail
#   formal/sync/run.sh --variants      every broken variant; says whether each one was caught
# Needs java 11+ and tla2tools 1.7.4: `mise use -g java@temurin-25 http:tla2tools@1.7.4`, or set
# JAVA and TLA2TOOLS_JAR. A failing run leaves TLC's full output in formal/sync/out/.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
jar="${TLA2TOOLS_JAR:-}"
java="${JAVA:-}"
if command -v mise >/dev/null; then
  [[ -n "$jar" ]] || jar="$(mise where http:tla2tools@1.7.4 2>/dev/null || true)/tla2tools.jar"
  [[ -n "$java" ]] || java="$(mise where java 2>/dev/null || true)/bin/java"
fi
[[ -x "${java:-}" ]] || java="java"
if [[ ! -f "$jar" ]]; then
  echo "tla2tools.jar not found. Run: mise use -g http:tla2tools@1.7.4, or set TLA2TOOLS_JAR." >&2
  exit 2
fi

# The three models the code must pass, and how long each takes on a 10-core laptop.
models=(TwoTabs TwoPhones Liveness) # about 2 min, 30 s, 90 s

# variant:model:property. Each variant breaks the code the way its name says (see README.md),
# and checking only `property` on `model` must find the break.
variants=(
  "no-idempotency:TwoPhones:ExactlyOnce"
  "create-then-insert:TwoPhones:ServerOrder"
  "no-gap-cut:TwoTabs:ConfirmedIsPrefix"
  "drop-on-lost-reply:TwoPhones:NothingDropped"
  "snapshot-shrink-check:TwoTabs:QuietMeansConverged"
  "no-retry-timer:Liveness:Delivered"
  "ignore-pokes:Liveness:Converges"
)
temporal=" Delivered Converges "

# check <model> <variant> [property]: runs TLC in a scratch directory; prints its output.
check() {
  local model="$1" variant="$2" property="${3:-}" work status
  work="$(mktemp -d)"
  cp "$here"/*.tla "$work/"
  sed "s/Variant = \"code\"/Variant = \"$variant\"/" "$here/$model.cfg" >"$work/$model.cfg"
  if [[ -n "$property" ]]; then
    sed -i.bak '/^INVARIANTS/,$d; /^PROPERTIES/,$d' "$work/$model.cfg"
    if [[ "$temporal" == *" $property "* ]]; then
      printf 'PROPERTIES\n    %s\n' "$property" >>"$work/$model.cfg"
    else
      printf 'INVARIANTS\n    %s\n' "$property" >>"$work/$model.cfg"
    fi
  fi
  set +e
  (cd "$work" && "$java" -XX:+UseParallelGC -cp "$jar" tlc2.TLC -workers auto -deadlock \
    -cleanup -config "$model.cfg" "$model.tla")
  status=$?
  set -e
  rm -rf "$work"
  return $status
}

save() {
  mkdir -p "$here/out"
  printf '%s\n' "$2" >"$here/out/$1.txt"
}

summary() {
  grep -E "is violated|Temporal properties were violated|No error has been found|distinct states found, 0|Finished in" <<<"$1" | tail -3
}

if [[ "${1:-}" == "--variants" ]]; then
  missed=0
  for entry in "${variants[@]}"; do
    IFS=: read -r variant model property <<<"$entry"
    output="$(check "$model" "$variant" "$property" 2>&1 || true)"
    save "$variant" "$output"
    if grep -qE "Invariant $property is violated|Temporal properties were violated" <<<"$output"; then
      echo "caught  $variant: $property fails in $model"
    else
      echo "MISSED  $variant: expected $property to fail in $model"
      missed=1
    fi
  done
  exit $missed
fi

if [[ $# -gt 0 ]]; then
  for entry in "${variants[@]}"; do
    IFS=: read -r variant model property <<<"$entry"
    if [[ "$variant" == "$1" ]]; then
      output="$(check "$model" "$variant" "$property" 2>&1 || true)"
      save "$variant" "$output"
      printf '%s\n' "$output"
      exit 0
    fi
  done
  echo "No variant named $1. Variants: ${variants[*]%%:*}" >&2
  exit 2
fi

failed=0
for model in "${models[@]}"; do
  echo "== $model"
  if output="$(check "$model" code 2>&1)"; then
    summary "$output"
  else
    save "$model" "$output"
    summary "$output"
    echo "FAILED: TLC output in formal/sync/out/$model.txt"
    failed=1
  fi
done
exit $failed
