#!/usr/bin/env bash
# ArcKit Session End Hook
#
# Records session activity to .arckit/session-state.md
# Fires on session stop, providing continuity between sessions.
#
# Input (stdin): JSON with session metadata
# Output (stdout): JSON with hookSpecificOutput

set -euo pipefail

INPUT=$(cat)

# Find repo root (look for projects/ directory)
CWD=$(echo "$INPUT" | jq -r '.cwd // "."' 2>/dev/null || echo ".")
REPO_ROOT="${CWD:-$PWD}"
while [[ "$REPO_ROOT" != "/" ]]; do
  if [[ -d "$REPO_ROOT/projects" ]] || [[ -d "$REPO_ROOT/.arckit" ]]; then
    break
  fi
  REPO_ROOT="$(dirname "$REPO_ROOT")"
done

# Only proceed if we found an ArcKit project
if [[ ! -d "$REPO_ROOT/projects" ]] && [[ ! -d "$REPO_ROOT/.arckit" ]]; then
  exit 0
fi

STATE_FILE="$REPO_ROOT/.arckit/session-state.md"
mkdir -p "$REPO_ROOT/.arckit"

# Initialise session state file if it doesn't exist
if [[ ! -f "$STATE_FILE" ]]; then
  cat > "$STATE_FILE" << 'TEMPLATE'
# ArcKit Session State

> Auto-maintained by session hooks. Do not edit the Session Log section manually.

## Current Focus

<!-- Update manually: what you're working on -->

## Pending Decisions

<!-- Update manually: unresolved choices -->

## Session Log

TEMPLATE
fi

# Get commits from last 2 hours
TIMESTAMP=$(date "+%Y-%m-%d %H:%M")
COMMITS=$(cd "$REPO_ROOT" && git log --oneline --since="2 hours ago" 2>/dev/null || echo "none")
COMMIT_COUNT=0
if [[ "$COMMITS" != "none" ]] && [[ -n "$COMMITS" ]]; then
  COMMIT_COUNT=$(echo "$COMMITS" | wc -l | tr -d ' ')
fi

# Get ARC-* artifact changes
ARTIFACTS=$(cd "$REPO_ROOT" && git diff --name-only HEAD~${COMMIT_COUNT} HEAD 2>/dev/null | grep -E "^projects/.*ARC-" | head -20 || echo "none")

# Detect artifact types created/modified
ARTIFACT_TYPES=""
if [[ "$ARTIFACTS" != "none" ]]; then
  ARTIFACT_TYPES=$(echo "$ARTIFACTS" | grep -oE 'ARC-[0-9]+-[A-Z]+-' | sed 's/ARC-[0-9]*-//;s/-$//' | sort -u | tr '\n' ', ' | sed 's/,$//')
fi

# Append session log entry
cat >> "$STATE_FILE" << EOF

### Session: ${TIMESTAMP}

**Commits:** ${COMMIT_COUNT}
$(if [[ "$COMMITS" != "none" ]] && [[ -n "$COMMITS" ]]; then echo "$COMMITS"; else echo "No commits this session"; fi)

**Artifacts modified:** $(if [[ -n "$ARTIFACT_TYPES" ]]; then echo "$ARTIFACT_TYPES"; else echo "none"; fi)
$(if [[ "$ARTIFACTS" != "none" ]] && [[ "$ARTIFACTS" != "" ]]; then echo "$ARTIFACTS" | sed 's/^/- /'; fi)

---
EOF

# Output result
jq -n --arg msg "Session activity recorded to .arckit/session-state.md (${COMMIT_COUNT} commits)" '{
  hookSpecificOutput: {
    hookEventName: "session-end",
    additionalContext: $msg
  }
}'
