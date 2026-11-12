#!/usr/bin/env bash
# End-to-end smoke test against a running server.
#
# It drives the same entry points a browser uses (server-action form posts and page GETs), so
# a broken form attribute, a lost session or a failing action shows up here. It needs a
# database with reference data; the first login seeds the demo accounts.
#
#   BASE=http://127.0.0.1:3000 WEEK=2026-11-16 scripts/smoke.sh
#
# Requires: curl, python3 (or python), and a server that is already running.
set -uo pipefail

BASE="${BASE:-http://127.0.0.1:3000}"
WEEK="${WEEK:-$(date -u +%Y-%m-%d)}"
WORK="$(mktemp -d)"
fail=0

# `python3` on Windows may be the Microsoft Store alias that fails at runtime, so the
# candidate has to prove it can run before it is trusted.
PYTHON=""
for candidate in python3 python py; do
  if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'print(1)' >/dev/null 2>&1; then
    PYTHON="$candidate"
    break
  fi
done
if [ -z "$PYTHON" ]; then
  echo "python is required for the html parsing steps" >&2
  exit 2
fi

cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

# Windows Python needs a Windows path, Linux Python the plain one.
wpath() { cygpath -w "$1" 2>/dev/null || printf '%s' "$1"; }

# action_id <html-file> <required-field> <button-substring>
action_id() {
  "$PYTHON" - "$(wpath "$1")" "$2" "$3" <<'PY'
import re, sys
html = open(sys.argv[1], encoding='utf-8').read()
field, needle = sys.argv[2], sys.argv[3]
for body in re.findall(r'<form[^>]*method="POST"[^>]*>(.*?)</form>', html, re.S):
    if f'name="{field}"' not in body:
        continue
    if needle and needle not in body:
        continue
    match = re.search(r'\$ACTION_ID_[a-f0-9]+', body)
    if match:
        print(match.group(0))
        break
PY
}

check() { # label actual expected
  if [ "$2" = "$3" ]; then echo "  ok   $1 ($2)"; else echo "  FAIL $1: got $2 expected $3"; fail=1; fi
}

login() {
  local email="$1" jar="$WORK/$2"
  rm -f "$jar"
  curl -s -c "$jar" "$BASE/login" -o "$WORK/login.html"
  local aid; aid=$(action_id "$WORK/login.html" email '')
  [ -n "$aid" ] || { echo "  FAIL login form not found"; fail=1; return; }
  local code
  code=$(curl -s -b "$jar" -c "$jar" -o /dev/null -w '%{http_code}' \
    -F "$aid=" -F "email=$email" -F "password=${CITYBUS_DEMO_PASSWORD:-demo1234}" "$BASE/login")
  if grep -q cb_session "$jar"; then echo "  ok   login $email"; else echo "  FAIL login $email (no session cookie)"; fail=1; fi
  [ "$code" = "303" ] || { echo "  FAIL login http $code"; fail=1; }
}

post_action() { # <html-file> <field> <needle> <jar-name> <url>
  local aid
  aid=$(action_id "$1" "$2" "$3")
  [ -n "$aid" ] || { echo "  FAIL action not found ($3)"; fail=1; return; }
  local code
  code=$(curl -s -b "$WORK/$4" -c "$WORK/$4" -o /dev/null -w '%{http_code}' \
    -F "$aid=" -F "week=$WEEK" "$5")
  check "POST $3" "$code" 303
}

echo "== planner"
login planlama@kutahya.local planner.txt
check "GET /network" "$(curl -s -b "$WORK/planner.txt" -o "$WORK/net.html" -w '%{http_code}' "$BASE/network")" 200

curl -s -b "$WORK/planner.txt" "$BASE/plan?week=$WEEK" -o "$WORK/plan.html"
post_action "$WORK/plan.html" week 'ret' planner.txt "$BASE/plan?week=$WEEK"

curl -s -b "$WORK/planner.txt" "$BASE/plan?week=$WEEK" -o "$WORK/plan2.html"
"$PYTHON" - "$(wpath "$WORK/plan2.html")" <<'PY'
import sys
html = open(sys.argv[1], encoding='utf-8').read()
print('  info plan: YAT=%d x=%d locked=%d' % (html.count('>YAT<'), html.count('>x<'), html.count('🔒')))
print('  info rules: %s' % ('no violation' if 'Kural ihlali yok' in html else 'see rule panel'))
PY

curl -s -b "$WORK/planner.txt" "$BASE/drivers?week=$WEEK" -o "$WORK/drivers.html"
check "GET /drivers" "$(curl -s -b "$WORK/planner.txt" -o /dev/null -w '%{http_code}' "$BASE/drivers?week=$WEEK")" 200
post_action "$WORK/drivers.html" week 'run cutting' planner.txt "$BASE/drivers?week=$WEEK"

check "GET /api/plan/xlsx" "$(curl -s -b "$WORK/planner.txt" -o "$WORK/plan-$WEEK.xlsx" -w '%{http_code}' "$BASE/api/plan/xlsx?week=$WEEK")" 200
echo "  info xlsx: $(wc -c < "$WORK/plan-$WEEK.xlsx") bytes"

curl -s -b "$WORK/planner.txt" "$BASE/plan?week=$WEEK" -o "$WORK/plan3.html"
post_action "$WORK/plan3.html" week 'nla' planner.txt "$BASE/plan?week=$WEEK"
check "GET /reports" "$(curl -s -b "$WORK/planner.txt" -o "$WORK/reports.html" -w '%{http_code}' "$BASE/reports?week=$WEEK")" 200

echo "== driver"
login sofor@kutahya.local driver.txt
check "GET /driver" "$(curl -s -b "$WORK/driver.txt" -o "$WORK/driver.html" -w '%{http_code}' "$BASE/driver?week=$WEEK")" 200
grep -q "Benim Haftam" "$WORK/driver.html" && echo "  ok   driver page renders" || { echo "  FAIL driver page content"; fail=1; }
check "driver redirected away from /plan" "$(curl -s -b "$WORK/driver.txt" -o /dev/null -w '%{http_code}' "$BASE/plan")" 307

echo "== dispatcher"
login santral@kutahya.local dispatcher.txt
check "GET /drivers (dispatcher)" "$(curl -s -b "$WORK/dispatcher.txt" -o /dev/null -w '%{http_code}' "$BASE/drivers?week=$WEEK")" 200

echo "== public endpoints"
check "GET /api/health" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/health")" 200
check "GET /api/gtfs" "$(curl -s -o "$WORK/feed.zip" -w '%{http_code}' "$BASE/api/gtfs")" 200
echo "  info gtfs: $(wc -c < "$WORK/feed.zip") bytes"
check "GET /api/plan/xlsx without session" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/plan/xlsx?week=$WEEK")" 401
check "GET / without session" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/")" 307

echo
if [ "$fail" = "0" ]; then echo "SMOKE OK"; else echo "SMOKE FAILED"; fi
exit "$fail"
