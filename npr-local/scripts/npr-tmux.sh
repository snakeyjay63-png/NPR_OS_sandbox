#!/usr/bin/env bash
# npr-tmux.sh — tmux launcher: NPR-Local + lazygit
# Alles draait BINNEN tmux. Geen background processes.
# Als tmux crasht → alles stopt. Clean.
#
# Layout:
#   ┌──────────────┬──────────────┬────────────┐
#   │  server      │  npr-tty     │  lazygit   │
#   │  (hidden)    │  (60%)       │  (30%)     │
#   └──────────────┴──────────────┴────────────┘

set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$DIR")"
SESSION="npr"
PORT="${NPR_PORT:-5000}"

# ─── check ───

for cmd in tmux node lazygit; do
  command -v "$cmd" &>/dev/null || { echo "no: $cmd"; exit 1; }
done

# ─── session ───

if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "sessie '$SESSION' bestaat al"
  echo "  tmux attach -t $SESSION"
  echo "  tmux kill-session -t $SESSION  (moord)"
  exit 0
fi

# ─── layout ───

# Window 0: server (hidden)
tmux new-session -d -s "$SESSION" -x 200 -y 50 \
  -c "$ROOT" \
  "PORT=$PORT node src/index.js"
tmux rename-window -t "${SESSION}:0" "srv"

# Window 1: work (tty + git)
tmux new-window -t "${SESSION}:1" -c "$ROOT" -n "work"

tmux split-window -h -p 30 -t "${SESSION}:1.0" \
  -c "$ROOT" \
  "lazygit"
tmux select-pane -t "${SESSION}:1.0" -T "tty"
tmux select-pane -t "${SESSION}:1.1" -T "git"

# ─── go ───

if [[ "${1:-}" == "-d" ]]; then
  echo "detached. → tmux attach -t $SESSION"
else
  tmux attach -t "$SESSION"
fi
