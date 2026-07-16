#!/usr/bin/env bash
# NPR Audit CLI — wrapper for audit_manager.py
set -euo pipefail

exec python3 "$HOME/.openclaw/workspace/NPR_OS_sandbox/audit_manager.py" "$@"
