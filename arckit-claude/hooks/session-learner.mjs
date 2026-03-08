#!/usr/bin/env node
/**
 * ArcKit Stop Hook — Session Learner
 *
 * Fires when a session ends (Stop event). Analyses recent git commits
 * to build a session summary and appends it to .arckit/memory/sessions.md.
 *
 * The summary captures:
 *   - Which artifact types were created or modified
 *   - Session classification (governance, research, procurement, review, general)
 *   - Commit summaries for context
 *
 * Designed to complement Claude Code's built-in auto-memory. Auto-memory
 * captures what Claude decides to remember; this hook captures what actually
 * happened (git commits, artifact types) without relying on Claude's judgement.
 *
 * Hook Type: Stop (Notification)
 * Input (stdin):  JSON with session_id, cwd, etc.
 * Output (stdout): empty (notification hook, no output required)
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { isDir, isFile, readText, parseHookInput } from './hook-utils.mjs';
import { DOC_TYPES } from '../config/doc-types.mjs';

const data = parseHookInput();
const cwd = data.cwd || '.';

// Only proceed if we're in a project with .arckit directory
if (!isDir(join(cwd, '.arckit'))) {
  process.exit(0);
}

// Collect recent git activity (last 2 hours)
let commits = '';
try {
  commits = execFileSync('git', ['log', '--since=2 hours ago', '--oneline', '--no-merges'], {
    cwd,
    encoding: 'utf8',
    timeout: 5000,
  }).trim();
} catch {
  process.exit(0);
}

if (!commits) process.exit(0);

const commitLines = commits.split('\n').filter(Boolean);
const commitCount = commitLines.length;

// Detect changed files from recent commits
let changedFiles = '';
try {
  changedFiles = execFileSync('git', ['log', '--since=2 hours ago', '--no-merges', '--name-only', '--pretty=format:'], {
    cwd,
    encoding: 'utf8',
    timeout: 5000,
  }).trim();
} catch {
  changedFiles = '';
}

const files = [...new Set(changedFiles.split('\n').filter(Boolean))];

// Detect artifact types from filenames using DOC_TYPES config
const detectedTypes = new Set();
for (const f of files) {
  for (const [code, info] of Object.entries(DOC_TYPES)) {
    if (f.includes(`-${code}-`) || f.includes(`-${code}.`)) {
      detectedTypes.add(`${info.name} (${info.category})`);
    }
  }
}

// Classify session type from DOC_TYPES categories
function classifySession(types) {
  const typeArr = [...types];
  const categories = typeArr.map(t => {
    const match = t.match(/\((.+)\)$/);
    return match ? match[1] : '';
  });

  if (categories.includes('Compliance') || categories.includes('Governance')) return 'governance';
  if (categories.includes('Research')) return 'research';
  if (categories.includes('Procurement')) return 'procurement';
  if (typeArr.some(t => t.includes('Review'))) return 'review';
  return 'general';
}

const sessionType = classifySession(detectedTypes);

// Extract commit message summaries (strip hashes)
const commitSummaries = commitLines.map(line => {
  const spaceIdx = line.indexOf(' ');
  return spaceIdx > 0 ? line.substring(spaceIdx + 1) : line;
});

// Build markdown entry
const now = new Date();
const dateStr = now.toISOString().substring(0, 10);
const timeStr = now.toISOString().substring(11, 16);
const artifactList = [...detectedTypes].join(', ') || 'none detected';

let entry = `\n### ${dateStr} ${timeStr} — ${sessionType}\n\n`;
entry += `- **Commits:** ${commitCount} | **Files changed:** ${files.length}\n`;
entry += `- **Artifacts:** ${artifactList}\n`;

if (commitSummaries.length > 0) {
  entry += '- **Summary:**\n';
  for (const s of commitSummaries.slice(0, 8)) {
    entry += `  - ${s}\n`;
  }
}

// Ensure memory directory and file exist
const memoryDir = join(cwd, '.arckit', 'memory');
mkdirSync(memoryDir, { recursive: true });

const sessionsFile = join(memoryDir, 'sessions.md');

// Read existing content or create with header
let existing = '';
if (isFile(sessionsFile)) {
  existing = readText(sessionsFile) || '';
}

if (!existing.trim()) {
  existing = '# Session Log\n\nAutomated session summaries captured by the ArcKit session-learner hook.\n';
}

// Append new entry and trim to last 30 sessions
const sections = existing.split(/\n(?=### \d{4}-\d{2}-\d{2})/);
const header = sections[0];
const entries = sections.slice(1);

// Add new entry at the start (most recent first)
entries.unshift(entry.trimStart());

// Keep last 30 sessions
const trimmed = entries.slice(0, 30);

const output = header.trimEnd() + '\n' + trimmed.map(e => '\n' + e).join('');

writeFileSync(sessionsFile, output);

process.exit(0);
