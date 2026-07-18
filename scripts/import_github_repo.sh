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

WORKDIR=""
STAGED_DIR=""
BACKUP_DIR=""

log() {
    printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$*"
}

warn() {
    printf '\n⚠️  %s\n' "$*" >&2
}

fail() {
    printf '\n❌ %s\n' "$*" >&2
    exit 1
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

cleanup() {
    local exit_code=$?

    if [[ $exit_code -ne 0 ]] &&
       [[ -n "${BACKUP_DIR:-}" ]] &&
       [[ -e "$BACKUP_DIR" ]] &&
       [[ ! -e "$TARGET" ]]; then
        mv "$BACKUP_DIR" "$TARGET" 2>/dev/null || true
    fi

    if [[ -n "${WORKDIR:-}" && -d "$WORKDIR" ]]; then
        rm -rf "$WORKDIR"
    fi

    return "$exit_code"
}
trap cleanup EXIT

validate_checkout() {
    local directory="$1"

    [[ -d "$directory" ]] || return 1
    [[ -n "$(find "$directory" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]] || return 1

    # Repositoryspecifieke minimale controle.
    [[ -s "$directory/00_README.md" ]] || return 1

    return 0
}

target_has_local_changes() {
    [[ -d "$TARGET/.git" ]] || return 1
    command_exists git || return 1
    [[ -n "$(git -C "$TARGET" status --porcelain 2>/dev/null)" ]]
}

prepare_target_parent() {
    local parent
    parent="$(dirname "$TARGET")"
    mkdir -p "$parent"
    [[ -w "$parent" ]] || fail "Doelmap is niet beschrijfbaar: $parent"
}

install_staged_checkout() {
    local source_directory="$1"
    local timestamp

    validate_checkout "$source_directory" ||
        fail "De opgehaalde repository is ongeldig of 00_README.md ontbreekt."

    prepare_target_parent
    timestamp="$(date '+%Y%m%d-%H%M%S')"

    if [[ -e "$TARGET" ]]; then
        if target_has_local_changes; then
            fail "Doelmap bevat lokale Git-wijzigingen en wordt niet overschreven: $TARGET"
        fi

        BACKUP_DIR="${TARGET}.backup.${timestamp}"
        while [[ -e "$BACKUP_DIR" ]]; do
            BACKUP_DIR="${TARGET}.backup.${timestamp}.$RANDOM"
        done

        log "Bestaande doelmap wordt tijdelijk veiliggesteld als: $BACKUP_DIR"
        mv "$TARGET" "$BACKUP_DIR"
    fi

    if mv "$source_directory" "$TARGET"; then
        validate_checkout "$TARGET" ||
            fail "Installatie is verplaatst, maar validatie van de doelmap faalde."

        if [[ -n "$BACKUP_DIR" && -e "$BACKUP_DIR" ]]; then
            rm -rf "$BACKUP_DIR"
            BACKUP_DIR=""
        fi
    else
        if [[ -n "$BACKUP_DIR" && -e "$BACKUP_DIR" && ! -e "$TARGET" ]]; then
            mv "$BACKUP_DIR" "$TARGET"
            BACKUP_DIR=""
        fi
        fail "Installatie van de nieuwe checkout is mislukt; de oude doelmap is hersteld."
    fi
}

extract_tar_archive() {
    local archive="$1"
    local destination="$2"

    command_exists tar || return 1
    mkdir -p "$destination"

    tar -xzf "$archive" \
        -C "$destination" \
        --strip-components=1
}

extract_zip_archive() {
    local archive="$1"
    local destination="$2"
    local extracted_directory

    command_exists unzip || return 1
    mkdir -p "$destination"

    unzip -q "$archive" -d "$destination"

    extracted_directory="$(
        find "$destination" \
            -mindepth 1 \
            -maxdepth 1 \
            -type d \
            -print \
            -quit
    )"

    [[ -n "$extracted_directory" ]] || return 1

    STAGED_DIR="${destination}.staged"
    rm -rf "$STAGED_DIR"
    mv "$extracted_directory" "$STAGED_DIR"
}

try_existing_checkout_update() {
    [[ -d "$TARGET/.git" ]] || return 1
    command_exists git || return 1

    if target_has_local_changes; then
        warn "Bestaande checkout bevat lokale wijzigingen; update wordt overgeslagen."
        return 1
    fi

    log "Bestaande Git-checkout gevonden; fast-forward-update wordt geprobeerd."

    git -C "$TARGET" fetch --prune origin "$BRANCH" &&
    git -C "$TARGET" checkout "$BRANCH" &&
    git -C "$TARGET" merge --ff-only "origin/$BRANCH" &&
    validate_checkout "$TARGET"
}

try_gh_clone() {
    command_exists gh || return 1
    gh auth status >/dev/null 2>&1 || return 1

    STAGED_DIR="$WORKDIR/gh-clone"
    log "Import via aangemelde GitHub CLI wordt geprobeerd."

    gh repo clone "${OWNER}/${REPO}" "$STAGED_DIR" \
        -- \
        --branch "$BRANCH" \
        --single-branch \
        --depth 1
}

try_https_clone() {
    command_exists git || return 1

    STAGED_DIR="$WORKDIR/https-clone"
    log "Import via Git HTTPS wordt geprobeerd."

    GIT_TERMINAL_PROMPT=0 git clone \
        --branch "$BRANCH" \
        --single-branch \
        --depth 1 \
        "$HTTPS_URL" \
        "$STAGED_DIR"
}

try_ssh_clone() {
    command_exists git || return 1
    command_exists ssh || return 1

    STAGED_DIR="$WORKDIR/ssh-clone"
    log "Import via Git SSH wordt geprobeerd."

    GIT_SSH_COMMAND="ssh -o BatchMode=yes -o ConnectTimeout=10" \
        git clone \
            --branch "$BRANCH" \
            --single-branch \
            --depth 1 \
            "$SSH_URL" \
            "$STAGED_DIR"
}

try_api_tarball() {
    command_exists curl || return 1
    command_exists tar || return 1

    local archive="$WORKDIR/repository.tar.gz"
    local http_code
    local -a headers=(
        -H "Accept: application/vnd.github+json"
        -H "X-GitHub-Api-Version: 2022-11-28"
    )

    if [[ -n "${GH_TOKEN:-}" ]]; then
        headers+=(-H "Authorization: Bearer ${GH_TOKEN}")
        log "Import via GitHub API met GH_TOKEN wordt geprobeerd."
    else
        log "Import via publieke GitHub API wordt geprobeerd."
    fi

    http_code="$(
        curl \
            --silent \
            --show-error \
            --location \
            --connect-timeout 15 \
            --max-time 180 \
            --retry 2 \
            --retry-all-errors \
            --output "$archive" \
            --write-out '%{http_code}' \
            "${headers[@]}" \
            "$API_URL" ||
        true
    )"

    [[ "$http_code" =~ ^2[0-9][0-9]$ ]] || {
        warn "GitHub API gaf HTTP-status ${http_code:-onbekend}."
        return 1
    }

    tar -tzf "$archive" >/dev/null 2>&1 || return 1

    STAGED_DIR="$WORKDIR/api-staged"
    extract_tar_archive "$archive" "$STAGED_DIR"
}

try_public_zip() {
    command_exists curl || return 1
    command_exists unzip || return 1

    local archive="$WORKDIR/repository.zip"
    local http_code

    log "Import via openbaar GitHub ZIP-archief wordt geprobeerd."

    http_code="$(
        curl \
            --silent \
            --show-error \
            --location \
            --connect-timeout 15 \
            --max-time 180 \
            --retry 2 \
            --retry-all-errors \
            --output "$archive" \
            --write-out '%{http_code}' \
            "$PUBLIC_ZIP_URL" ||
        true
    )"

    [[ "$http_code" =~ ^2[0-9][0-9]$ ]] || {
        warn "ZIP-download gaf HTTP-status ${http_code:-onbekend}."
        return 1
    }

    unzip -tq "$archive" >/dev/null 2>&1 || return 1
    extract_zip_archive "$archive" "$WORKDIR/zip-unpacked"
}

finish_import() {
    local method="$1"

    validate_checkout "$STAGED_DIR" || {
        warn "$method leverde geen geldige checkout op."
        return 1
    }

    install_staged_checkout "$STAGED_DIR"
    printf '\n✅ Repository geïmporteerd via %s: %s\n' "$method" "$TARGET"
    exit 0
}

log "Repository: ${OWNER}/${REPO}"
log "Branch: ${BRANCH}"
log "Doelmap: ${TARGET}"

if try_existing_checkout_update; then
    printf '\n✅ Bestaande repository veilig bijgewerkt: %s\n' "$TARGET"
    exit 0
fi

WORKDIR="$(mktemp -d)"

if try_gh_clone; then
    finish_import "GitHub CLI"
fi

if try_https_clone; then
    finish_import "Git HTTPS"
fi

if try_ssh_clone; then
    finish_import "Git SSH"
fi

if try_api_tarball; then
    finish_import "GitHub API"
fi

if try_public_zip; then
    finish_import "publiek ZIP-archief"
fi

cat >&2 <<EOF

❌ Geen bruikbare importroute is geslaagd.

Gecontroleerd:
  - bestaande checkout met fast-forward-update;
  - aangemelde GitHub CLI;
  - Git HTTPS;
  - Git SSH;
  - GitHub API, optioneel met GH_TOKEN;
  - openbaar ZIP-archief.

Mogelijke oorzaken:
  1. GitHub of DNS is vanuit deze sandbox niet bereikbaar;
  2. repository of branch bestaat niet;
  3. geldige leesrechten voor een privérepository ontbreken;
  4. organisatie-SSO is niet geautoriseerd;
  5. vereiste programma's ontbreken;
  6. de doelmap is niet beschrijfbaar.

Veilige eigenschap:
  Een bestaande doelmap met lokale Git-wijzigingen wordt nooit verwijderd.
  Een vervanging gebeurt pas nadat de nieuwe checkout volledig is gedownload
  en gevalideerd. Bij een installatiefout wordt de oude map hersteld.
EOF

exit 1
