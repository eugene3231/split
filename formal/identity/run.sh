#!/bin/sh
# Model-checks formal/identity/Identity.tla with TLC, on each config in this folder.
#
#   formal/identity/run.sh                    check every property on the code as it is
#   formal/identity/run.sh --broken NAME      check a deliberately broken variant (see the skill)
#   formal/identity/run.sh --only PROPERTY    check one property
#   formal/identity/run.sh --config NAME      check one config: TwoTabs or TwoPhones
#   formal/identity/run.sh --trace            print the full TLC trace of each violation
#
# TLC checks all properties of a config in one pass and stops at the first one that breaks,
# with its shortest counterexample. The script then drops that property and runs again, until
# the rest hold. A "config property" line in known-findings.txt is a finding the code has not
# fixed yet, so its violation is expected. Exits 0 when every result matches that list, 1 when
# a property breaks that should hold or a known finding no longer breaks (update the list), and
# 2 on a setup or model error.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
broken=none
only=
configs="TwoTabs TwoPhones"
trace=no
while [ $# -gt 0 ]; do
  case $1 in
    --broken) broken=$2; shift 2 ;;
    --only) only=$2; shift 2 ;;
    --config) configs=$2; shift 2 ;;
    --trace) trace=yes; shift ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

jar=${TLA2TOOLS_JAR:-}
if [ -z "$jar" ]; then
  if ! command -v mise >/dev/null; then
    echo "Needs TLA2TOOLS_JAR=/path/to/tla2tools.jar, or mise to install it." >&2
    exit 2
  fi
  mise install -q http:tla2tools@1.7.4 >/dev/null 2>&1 || true
  jar=$(mise where http:tla2tools@1.7.4)/tla2tools.jar
fi
java=${JAVA:-}
if [ -z "$java" ]; then
  # macOS ships a /usr/bin/java stub with no runtime behind it, so prefer mise's Java.
  if command -v mise >/dev/null && mise where java >/dev/null 2>&1; then
    java=$(mise where java)/bin/java
  else
    java=java
  fi
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cp "$here/Identity.tla" "$work/"

status=0
for config in $configs; do
  remaining=$(awk '/^INVARIANTS/ { inv = 1; next } inv && /^  / { print $1; next } { inv = 0 }' \
    "$here/$config.cfg" | grep -v '^TypeOK$')
  if [ -n "$only" ]; then remaining=$only; fi
  broke=
  while [ -n "$remaining" ]; do
    awk -v keep=" TypeOK $(echo $remaining) " -v broken="$broken" '
      /^  Broken = / { print "  Broken = \"" broken "\""; next }
      /^INVARIANTS/ { print; inv = 1; next }
      inv && /^  / { if (index(keep, " " $1 " ") > 0) print; next }
      { inv = 0; print }
    ' "$here/$config.cfg" > "$work/Identity.cfg"
    start=$(date +%s)
    result=0
    (cd "$work" && "$java" -XX:+UseParallelGC -cp "$jar" tlc2.TLC -workers auto -cleanup \
      -config Identity.cfg Identity.tla > tlc.out 2>&1) || result=$?
    took=$(( $(date +%s) - start ))
    states=$(grep -o '[0-9,]* distinct states found' "$work/tlc.out" | tail -1)
    if [ "$result" = 0 ]; then
      for property in $remaining; do echo "$config $property: holds ($states, ${took}s)"; done
      break
    fi
    property=$(sed -n 's/^Error: Invariant \([A-Za-z]*\) is violated.*/\1/p' "$work/tlc.out" | head -1)
    if [ -z "$property" ]; then
      echo "$config: TLC failed (exit $result)" >&2
      grep -v '^Progress\|^@!@!@' "$work/tlc.out" | tail -30 >&2
      exit 2
    fi
    echo "$config $property: breaks (${took}s), shortest path:"
    if [ "$trace" = yes ]; then
      sed -n '/^Error: The behavior up to this point is:/,/distinct states found/p' "$work/tlc.out"
    else
      grep '^State [0-9]*:' "$work/tlc.out" |
        sed 's/^State \([0-9]*\): <\([A-Za-z]*\).*/  \1. \2/; s/^State 1: .*/  1. Init/'
    fi
    broke="$broke $property"
    remaining=$(echo "$remaining" | grep -vx "$property" || true)
  done

  if [ "$broken" = none ]; then
    known=$(awk -v c="$config" '!/^#/ && $1 == c { print $2 }' "$here/known-findings.txt")
    for property in $broke; do
      if ! echo "$known" | grep -qx "$property"; then
        echo "  !! $config $property breaks and is not a known finding" ; status=1
      fi
    done
    for property in $known; do
      if [ -n "$only" ] && [ "$property" != "$only" ]; then continue; fi
      if ! echo "$broke" | grep -qw "$property"; then
        echo "  !! $config $property is a known finding but now holds: update known-findings.txt"
        status=1
      fi
    done
  fi
done
exit "$status"
