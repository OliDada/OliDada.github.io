#!/bin/sh
# Runs the browser tests against a local copy of the page. Needs Node with Playwright (npm i playwright).
#   sh tests/run.sh
cd "$(dirname "$0")/.." || exit 1
python3 -m http.server 8766 >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1
mkdir -p tests/out
for t in tests/*.test.js; do
  echo "== $t"
  URL=http://localhost:8766/index.html node "$t" || exit 1
done
