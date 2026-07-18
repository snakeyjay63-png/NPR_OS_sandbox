#!/usr/bin/env bash

set -Eeuo pipefail

OWNER="${1:-snakeyjay63-png}"
REPO="${2:-NPR_OS_sandbox}"
FILE_PATH="${3:-00_README.md}"
BRANCH="${4:-main}"
OUTPUT="${5:-$(basename "$FILE_PATH")}"

API_URL="https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}"

HEADERS=(
 -H "Accept: application/vnd.github.raw+json"
 -H "X-GitHub-Api-Version: 2022-11-28"
)

if [[ -n "${GH_TOKEN:-}" ]]; then
 HEADERS+=(
 -H "Authorization: Bearer ${GH_TOKEN}"
 )
fi

HTTP_CODE="$(
 curl \
 --silent \
 --show-error \
 --location \
 --output "$OUTPUT.tmp" \
 --write-out '%{http_code}' \
 "${HEADERS[@]}" \
 "$API_URL" ||
 true
)"

if [[ "$HTTP_CODE" =~ ^2[0-9][0-9]$ ]] &&
 [[ -s "$OUTPUT.tmp" ]]; then
 mv "$OUTPUT.tmp" "$OUTPUT"
 printf '✅ Bestand opgeslagen als: %s\n' "$OUTPUT"
else
 rm -f "$OUTPUT.tmp"
 printf '❌ Download mislukt; HTTP-status: %s\n' \
 "${HTTP_CODE:-onbekend}" >&2
 exit 1
fi
