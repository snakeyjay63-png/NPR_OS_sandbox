#!/usr/bin/env bash

set -Eeuo pipefail

OWNER="${1:-snakeyjay63-png}"
REPO="${2:-NPR_OS_sandbox}"
BRANCH="${3:-main}"
TARGET="${4:-$REPO}"

HTTPS_URL="https://github.com/${OWNER}/${REPO}.git"
SSH_URL="git@github.com:${OWNER}/${REPO}.git"
API_URL="https://api.github.com/repos/${OWNER}/${REPO}/tarball/${BRANCH}"
PUBLIC_ZIP_URL="https://github.com/${OWNER}/${REPO}/archive/refs/heads/${BRANCH}.zip"

log() {
 printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$*"
}

fail() {
 printf '\n❌ %s\n' "$*" >&2
 exit 1
}

command_exists() {
 command -v "$1" >/dev/null 2>&1
}

validate_target() {
 local directory="$1"

 [[ -d "$directory" ]] || return 1
 [[ -n "$(find "$directory" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]] || return 1

 return 0
}

replace_target() {
 local source_directory="$1"

 rm -rf "$TARGET"
 mv "$source_directory" "$TARGET"

 validate_target "$TARGET" ||
 fail "De importmap bestaat, maar bevat geen bestanden."
}

extract_tar_archive() {
 local archive="$1"
 local workdir="$2"

 mkdir -p "$workdir/extracted"

 tar -xzf "$archive" \
 -C "$workdir/extracted" \
 --strip-components=1

 replace_target "$workdir/extracted"
}

extract_zip_archive() {
 local archive="$1"
 local workdir="$2"

 command_exists unzip ||
 return 1

 mkdir -p "$workdir/unzipped"

 unzip -q "$archive" -d "$workdir/unzipped"

 local extracted_directory
 extracted_directory="$(
 find "$workdir/unzipped" \
 -mindepth 1 \
 -maxdepth 1 \
 -type d \
 -print \
 -quit
 )"

 [[ -n "$extracted_directory" ]] || return 1

 replace_target "$extracted_directory"
}

cleanup() {
 if [[ -n "${WORKDIR:-}" && -d "$WORKDIR" ]]; then
 rm -rf "$WORKDIR"
 fi
}

trap cleanup EXIT

log "Repository: ${OWNER}/${REPO}"
log "Branch: ${BRANCH}"
log "Doelmap: ${TARGET}"

# ------------------------------------------------------------
# Methode 1: bestaande Git-checkout bijwerken
# ------------------------------------------------------------

if [[ -d "$TARGET/.git" ]] && command_exists git; then
 log "Bestaande Git-checkout gevonden; update wordt geprobeerd."

 if git -C "$TARGET" fetch origin "$BRANCH" &&
 git -C "$TARGET" checkout "$BRANCH" &&
 git -C "$TARGET" pull --ff-only origin "$BRANCH"; then
 printf '\n✅ Bestaande repository bijgewerkt: %s\n' "$TARGET"
 exit 0
 fi

 log "Bijwerken is mislukt; een verse import wordt geprobeerd."
fi

WORKDIR="$(mktemp -d)"

# ------------------------------------------------------------
# Methode 2: GitHub CLI
# ------------------------------------------------------------

if command_exists gh; then
 log "GitHub CLI gevonden."

 if gh auth status >/dev/null 2>&1; then
 log "GitHub CLI is aangemeld; clone wordt geprobeerd."

 if gh repo clone "${OWNER}/${REPO}" "$WORKDIR/gh-clone" \
 -- \
 --branch "$BRANCH" \
 --single-branch; then

 replace_target "$WORKDIR/gh-clone"
 printf '\n✅ Geïmporteerd met GitHub CLI: %s\n' "$TARGET"
 exit 0
 fi
 else
 log "GitHub CLI is niet aangemeld."
 fi
fi

# ------------------------------------------------------------
# Methode 3: Git via HTTPS
#
# Git kan hierbij bestaande credential helpers gebruiken.
# Wanneer GH_TOKEN beschikbaar is, gebruikt de latere API-methode
# het token zonder het in de clone-URL te plaatsen.
# ------------------------------------------------------------

if command_exists git; then
 log "Git-clone via HTTPS wordt geprobeerd."

 if GIT_TERMINAL_PROMPT=0 git clone \
 --branch "$BRANCH" \
 --single-branch \
 "$HTTPS_URL" \
 "$WORKDIR/https-clone"; then

 replace_target "$WORKDIR/https-clone"
 printf '\n✅ Geïmporteerd via Git HTTPS: %s\n' "$TARGET"
 exit 0
 fi
fi

# ------------------------------------------------------------
# Methode 4: Git via SSH
#
# BatchMode voorkomt dat een niet-interactieve sandbox blijft hangen.
# ------------------------------------------------------------

if command_exists git && command_exists ssh; then
 log "Git-clone via SSH wordt geprobeerd."

 if GIT_SSH_COMMAND="ssh -o BatchMode=yes -o ConnectTimeout=10" \
 git clone \
 --branch "$BRANCH" \
 --single-branch \
 "$SSH_URL" \
 "$WORKDIR/ssh-clone"; then

 replace_target "$WORKDIR/ssh-clone"
 printf '\n✅ Geïmporteerd via Git SSH: %s\n' "$TARGET"
 exit 0
 fi
fi

# ------------------------------------------------------------
# Methode 5: GitHub API-archief
#
# Voor private repositories:
# export GH_TOKEN="..."
#
# Het token moet toegang hebben tot de repository en de inhoud
# mogen lezen.
# ------------------------------------------------------------

if command_exists curl; then
 log "GitHub API-archief wordt geprobeerd."

 CURL_HEADERS=(
 -H "Accept: application/vnd.github+json"
 -H "X-GitHub-Api-Version: 2022-11-28"
 )

 if [[ -n "${GH_TOKEN:-}" ]]; then
 CURL_HEADERS+=(
 -H "Authorization: Bearer ${GH_TOKEN}"
 )
 log "Authenticatietoken gevonden in GH_TOKEN."
 else
 log "Geen GH_TOKEN gevonden; alleen publieke API-toegang is mogelijk."
 fi

 HTTP_CODE="$(
 curl \
 --silent \
 --show-error \
 --location \
 --output "$WORKDIR/repository.tar.gz" \
 --write-out '%{http_code}' \
 "${CURL_HEADERS[@]}" \
 "$API_URL" ||
 true
 )"

 if [[ "$HTTP_CODE" =~ ^2[0-9][0-9]$ ]] &&
 tar -tzf "$WORKDIR/repository.tar.gz" >/dev/null 2>&1; then

 extract_tar_archive \
 "$WORKDIR/repository.tar.gz" \
 "$WORKDIR/api"

 printf '\n✅ Geïmporteerd via de GitHub API: %s\n' "$TARGET"
 exit 0
 fi

 log "API-download niet beschikbaar; HTTP-status: ${HTTP_CODE:-onbekend}."
fi

# ------------------------------------------------------------
# Methode 6: openbaar ZIP-archief
# ------------------------------------------------------------

if command_exists curl && command_exists unzip; then
 log "Openbaar GitHub ZIP-archief wordt geprobeerd."

 HTTP_CODE="$(
 curl \
 --silent \
 --show-error \
 --fail-with-body \
 --location \
 --output "$WORKDIR/repository.zip" \
 --write-out '%{http_code}' \
 "$PUBLIC_ZIP_URL" ||
 true
 )"

 if [[ "$HTTP_CODE" =~ ^2[0-9][0-9]$ ]] &&
 unzip -tq "$WORKDIR/repository.zip" >/dev/null 2>&1; then

 extract_zip_archive \
 "$WORKDIR/repository.zip" \
 "$WORKDIR/zip"

 printf '\n✅ Openbaar ZIP-archief geïmporteerd: %s\n' "$TARGET"
 exit 0
 fi
fi

cat >&2 <<EOF

❌ De repository kon niet worden geïmporteerd.

Mogelijke oorzaken:

1. de sandbox heeft geen internettoegang;
2. de repository of branch bestaat niet;
3. de repository is privé en geldige leesrechten ontbreken;
4. GitHub CLI is niet aangemeld;
5. GH_TOKEN ontbreekt, is verlopen of heeft onvoldoende rechten;
6. de SSH-sleutel is niet gekoppeld aan een bevoegd GitHub-account;
7. git, curl, tar of unzip ontbreekt;
8. een organisatie blokkeert toegang via SSO- of beveiligingsbeleid.

Repository:
 ${OWNER}/${REPO}

Branch:
 ${BRANCH}

Mogelijke oplossingen:

 gh auth login

of:

 export GH_TOKEN="EEN_GELDIG_TOKEN"
 ./import_github_repo.sh "$OWNER" "$REPO" "$BRANCH" "$TARGET"

Plaats tokens nooit rechtstreeks in dit script, in een Git-URL,
in een README, in logs of in versiebeheer.
EOF

exit 1
