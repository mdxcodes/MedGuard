#!/bin/bash
BASE_URL="${1:-http://localhost:5173}"
OUT_DIR="${2:-artifacts/visual-qa}"
WAIT=5000
mkdir -p "$OUT_DIR"
CHROME="google-chrome-stable --headless --disable-gpu --no-sandbox --disable-dev-shm-usage --remote-debugging-port=9222"
$CHROME --remote-debugging-port=9222 &
CHROME_PID=$!
sleep 3
screenshot() {
  local url="$1"
  local name="$2"
  RESPONSE=$(curl -s "http://localhost:9222/json/new?$url")
  TARGET_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])") 2>/dev/null || echo ""
  if [ -z "$TARGET_ID" ] || [ "$TARGET_ID" = "None" ]; then
    echo "Failed to create tab for $url"
    return 1
  fi
  sleep 3
  curl -s "http://localhost:9222/screenshot?target=$TARGET_ID" -o "$OUT_DIR/$name.png" -d "{\"format\":\"png\"}" -H "Content-Type: application/json"
  curl -s "http://localhost:9222/json/close/$TARGET_ID" > /dev/null
}
screenshot "$BASE_URL/" "01-patient-home"
screenshot "$BASE_URL/assessment" "02-patient-assessment"
screenshot "$BASE_URL/result" "03-patient-result"
screenshot "$BASE_URL/about" "04-patient-about"
screenshot "$BASE_URL/performance" "05-research-performance"
screenshot "$BASE_URL/explainability" "06-research-explainability"
screenshot "$BASE_URL/dataset" "07-dataset-explorer"
screenshot "$BASE_URL/errors" "08-error-analysis"
screenshot "$BASE_URL/experiments" "09-experiments"
screenshot "$BASE_URL/registry" "10-model-registry"
screenshot "$BASE_URL/methodology" "11-methodology"
kill $CHROME_PID 2>/dev/null
echo "Done. Screenshots in $OUT_DIR/"
