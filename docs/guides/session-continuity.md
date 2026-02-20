# Session Continuity Guide

ArcKit provides session-to-session continuity so that when you start a new Claude Code session, you automatically receive context about what happened in previous sessions.

## What Session Continuity Provides

- **At session start:** The existing `arckit-session.sh` hook reads `.arckit/session-state.md` and surfaces previous session context (recent commits, modified artifacts, your current focus, and pending decisions)
- **At session end:** A new `session-end.sh` Stop hook records what happened during the session (commits made, ARC artifact types modified) and appends a timestamped log entry

Together, these two hooks create a continuous thread of context across sessions without any manual effort.

## How It Works

### Session Start (arckit-session.sh)

When a Claude Code session starts (or resumes, clears, or compacts), the `arckit-session.sh` hook:

1. Injects the ArcKit plugin version and checks for a `projects/` directory (existing behaviour)
2. Reads `.arckit/session-state.md` if it exists
3. Extracts the last 2 session log entries and surfaces them as "Previous Sessions"
4. Extracts the "Current Focus" and "Pending Decisions" sections if they contain content

### Session End (session-end.sh)

When a Claude Code session stops, the `session-end.sh` Stop hook:

1. Locates the repository root by searching for `projects/` or `.arckit/` directories
2. Creates `.arckit/session-state.md` from the template if it does not exist
3. Gathers commits from the last 2 hours via `git log`
4. Identifies ARC artifact files that were changed
5. Detects artifact document type codes (e.g., REQ, ADR, HLD) from the filenames
6. Appends a timestamped session log entry to the file

## Session State File Structure

The session state file at `.arckit/session-state.md` has three sections:

```markdown
# ArcKit Session State

> Auto-maintained by session hooks. Do not edit the Session Log section manually.

## Current Focus

<!-- Update manually: what you're working on -->

## Pending Decisions

<!-- Update manually: unresolved choices -->

## Session Log

### Session: 2026-02-20 14:30

**Commits:** 3
abc1234 feat: add requirements document
def5678 feat: add stakeholder analysis
ghi9012 fix: correct project ID in HLD

**Artifacts modified:** REQ, STKH, HLD
- projects/alpha/ARC-001-REQ-v1.md
- projects/alpha/ARC-001-STKH-v1.md
- projects/alpha/ARC-001-HLD-v1.md

---
```

### Current Focus (Manual)

Use this section to record what you are currently working on. This is read by the session start hook and surfaced at the beginning of each new session.

Example:

```markdown
## Current Focus

Working on the security assessment for Project Alpha. Need to complete the DPIA
before the governance board review on Friday.
```

### Pending Decisions (Manual)

Use this section to record unresolved choices that carry across sessions. This helps you (and Claude) remember what still needs deciding.

Example:

```markdown
## Pending Decisions

- Whether to use AWS PrivateLink or VPN for the SAP connectivity pattern
- Choice of API gateway: Kong vs AWS API Gateway
- Data residency requirements for the EU expansion
```

### Session Log (Automatic)

This section is auto-appended by `session-end.sh`. Each entry records:

- **Timestamp** of session end
- **Commit count** and one-line summaries from the last 2 hours
- **Artifact types** modified (document type codes like REQ, ADR, HLD)
- **Artifact file paths** that were changed

Do not manually edit the Session Log section; it is maintained by the hook.

## Example Workflow

### Session A: Create Requirements

```
You: /arckit:requirements for Project Alpha
Claude: [Creates ARC-001-REQ-v1.md with functional and non-functional requirements]
You: /arckit:stakeholders for Project Alpha
Claude: [Creates ARC-001-STKH-v1.md with stakeholder analysis]
```

When Session A ends, the hook records:

```
### Session: 2026-02-20 10:00
**Commits:** 2
**Artifacts modified:** REQ, STKH
```

### Session B: Continue with Architecture

When Session B starts, Claude sees:

```
## Previous Sessions

### Session: 2026-02-20 10:00
**Commits:** 2
**Artifacts modified:** REQ, STKH
```

Claude now knows that requirements and stakeholder analysis were created in the previous session and can build on that context.

## Configuration

Session continuity is enabled automatically when the ArcKit plugin is installed. No additional configuration is required.

The `.arckit/` directory is created on first session end if it does not already exist. You may wish to add `.arckit/session-state.md` to `.gitignore` if you do not want session state tracked in version control (it contains only local working context, not project artifacts).

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| No "Previous Sessions" at start | No `.arckit/session-state.md` exists yet | Complete at least one session; the file is created on first session end |
| Session log shows 0 commits | No commits in the last 2 hours | This is normal if you were reading/planning rather than committing |
| Artifacts list shows "none" | Changes were not to `projects/*/ARC-*` files | Only ARC-prefixed files in the projects directory are tracked |
| Hook does not fire | Not an ArcKit project | The hook exits silently if neither `projects/` nor `.arckit/` exist |
