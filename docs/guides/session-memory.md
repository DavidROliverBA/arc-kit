# Session Memory

ArcKit includes automated session capture that records what happened during each Claude Code session. This complements Claude Code's built-in auto-memory by tracking the *actual work done* (git commits, artifact types) rather than relying on what Claude decides to remember.

## How It Works

```
Session N ends
  └── session-learner.mjs (Stop hook) analyses recent git commits
       └── appends summary to .arckit/memory/sessions.md

Session N+1 starts
  └── arckit-session.mjs (SessionStart hook) reads sessions.md
       └── surfaces last 3 sessions as context
```

The Stop hook fires automatically when a session ends. No configuration needed beyond installing the ArcKit plugin.

## What Gets Captured

Each session entry includes:

- **Session classification** — governance, research, procurement, review, or general (auto-detected from artifact types)
- **Commit count and files changed** — quantitative measure of session activity
- **Artifact types** — which ArcKit document types (ADR, HLDR, WARD, etc.) were created or modified
- **Commit summaries** — up to 8 commit messages for context

## Session Classification

Sessions are classified by the dominant category of artifacts touched:

| Classification | Triggered by |
|---|---|
| `governance` | Compliance or Governance artifacts (TCOP, SECD, DPIA, RISK, TRAC, etc.) |
| `research` | Research artifacts (RSCH, AWRS, AZRS, GCRS) |
| `procurement` | Procurement artifacts (SOW, EVAL, DOS, GCLD, VEND) |
| `review` | Review artifacts (HLDR, DLDR, SVCASS) |
| `general` | Everything else |

## Storage

Session history is stored in `.arckit/memory/sessions.md` — a rolling log of the last 30 sessions. This file can be committed to git for team visibility, or added to `.gitignore` for individual use.

### Example Entry

```markdown
### 2026-03-08 14:30 — governance

- **Commits:** 4 | **Files changed:** 7
- **Artifacts:** Secure by Design (Compliance), Architecture Decision Records (Architecture)
- **Summary:**
  - feat: add SECD assessment for cloud migration
  - docs: update ADR-003 with security review outcome
  - fix: correct risk rating in RISK register
  - chore: update traceability matrix
```

## Relationship to Auto-Memory

| Feature | Claude Auto-Memory | Session Learner |
|---|---|---|
| **What it captures** | What Claude decides is important | What actually happened (git commits) |
| **Trigger** | Automatic (Claude's judgement) | Deterministic (Stop hook on every session) |
| **Storage** | `~/.claude/projects/<project>/memory/` (machine-local) | `.arckit/memory/sessions.md` (in-repo) |
| **Team sharing** | Not shareable | Committable to git |
| **Content** | Freeform insights, preferences | Structured session summaries |

The two systems are complementary, not competing. Auto-memory captures *insights*; session-learner captures *activity*.

## Troubleshooting

**No sessions.md created after ending a session:**
- Check that `.arckit/` directory exists in your project root
- Verify there were git commits in the last 2 hours
- Check hook registration: `hooks.json` should include a `Stop` event

**Session classification seems wrong:**
- Classification is based on artifact type codes in filenames (e.g., `ARC-001-SECD-v1.md`)
- Non-ARC files don't contribute to classification
- Sessions with no detected ARC artifacts default to `general`
