#!/usr/bin/env bash

set -Eeuo pipefail

OWNER="${1:-snakeyjay63-png}"
REPO="${2:-NPR_OS_sandbox}"
FILE_PATH="${3:-00_README.md}"
BRANCH="${4:-main}"
OUTPUT="${5:-$(basename "$FILE_PATH")}"

API_URL="https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}"

log() {
 printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$*"
}

fail() {
 printf '\n❌ %s\n' "$*" >&2
 exit 1
}

cleanup() {
 rm -f "${OUTPUT}.tmp" 2>/dev/null || true
}
trap cleanup EXIT

prepare_parent() {
 local parent
 parent="$(dirname "$OUTPUT")"
 [[ "$parent" == "." ]] && return 0
 mkdir -p "$parent"
 [[ -w "$parent" ]] || fail "Output-pad niet beschrijfbaar: $parent"
}

log "Bestand: ${OWNER}/${REPO}/${FILE_PATH} (${BRANCH})"
log "Output: ${OUTPUT}"

prepare_parent

HEADERS=(
 -H "Accept: application/vnd.github.raw+json"
 -H "X-GitHub-Api-Version: 2022-11-28"
)

if [[ -n "${GH_TOKEN:-}" ]]; then
 HEADERS+=(
 -H "Authorization: Bearer ${GH_TOKEN}"
 )
 log "Import via GitHub API met GH_TOKEN wordt geprobeerd."
else
 log "Import via publieke GitHub API wordt geprobeerd."
fi

HTTP_CODE="$(
 curl \
 --silent \
 --show-error \
 --location \
 --connect-timeout 15 \
 --max-time 120 \
 --retry 2 \
 --retry-all-errors \
 --output "${OUTPUT}.tmp" \
 --write-out '%{http_code}' \
 "${HEADERS[@]}" \
 "$API_URL" ||
 true
)"

if [[ "$HTTP_CODE" =~ ^2[0-9][0-9]$ ]] &&
 [[ -s "${OUTPUT}.tmp" ]]; then
 mv "${OUTPUT}.tmp" "$OUTPUT"
 printf '\n✅ Bestand opgeslagen als: %s\n' "$OUTPUT"
else
 rm -f "${OUTPUT}.tmp"
 printf '\n❌ Download mislukt; HTTP-status: %s\n' \
 "${HTTP_CODE:-onbekend}" >&2
 exit 1
fi
