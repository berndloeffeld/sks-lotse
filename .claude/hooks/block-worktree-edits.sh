#!/usr/bin/env bash
# PreToolUse (Write|Edit|MultiEdit): blocks edits inside .claude/worktrees/.
# CLAUDE.md > Working Directory: "All file edits must be made in the canonical
# project root ... Never write to a git worktree path (e.g. .claude/worktrees/...)."
set -euo pipefail

input=$(cat)
file_path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')

if [[ "$file_path" == *".claude/worktrees"* ]]; then
  echo "Blocked: '$file_path' is inside a git worktree (.claude/worktrees/...). Edit files in the canonical project root instead (see CLAUDE.md > Working Directory)." >&2
  exit 2
fi

exit 0
