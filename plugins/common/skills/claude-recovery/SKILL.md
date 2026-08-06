---
name: claude-recovery
description: ACTIVATE when files or a whole directory/worktree were deleted, lost, or overwritten and the user wants them back — especially gitignored files (.claude/, .env, plans, local settings) that no git command can restore. ACTIVATE for 'recover', 'récupérer', 'restore deleted', 'fichiers perdus', 'deleted workspace', 'deleted worktree', 'lost my .claude', 'undelete'. Rebuilds file contents from Claude Code session transcripts in ~/.claude/projects/ by replaying every Write/Edit/full-Read event chronologically, then restores them to their original location without silently overwriting anything. DO NOT use for git-tracked content (use git reflog/branches first) or files no Claude session ever read or wrote.
version: 1.0.0
---

# Claude Recovery

Rebuild lost files from Claude Code session transcripts and restore them to their original location.

## How it works

Every Claude Code session is archived as JSONL under `~/.claude/projects/<munged-project-path>/`. Those transcripts contain the **full content** of every file the session touched:

- a `Write` tool call carries the complete file content
- a full `Read` result carries the file content (line-number prefixed)
- an `Edit` / `MultiEdit` call carries its `old_string` / `new_string` pairs

The bundled script replays these events chronologically per file: start from the latest full snapshot, apply every later edit on top. The result is the file exactly as the last session saw it.

**Limits — state them to the user up front:**

- A file no session ever read or wrote is invisible to this method.
- Manual changes made after the last session touched a file are not captured.
- Git-tracked content is better restored from git (`git reflog`, branches in the main repo if the deleted directory was a worktree). Use this skill for what git does NOT have: gitignored files (`.claude/`, `.env`, local settings, plans) and never-committed work.

## Workflow

### 1. Identify the lost path and its transcripts

Establish the **original absolute root** the files lived under (ask if not given). Then check the script can find its transcripts:

```bash
python3 <this-skill-dir>/scripts/recover.py /original/path --list-only
```

If auto-discovery fails, find the transcript directory manually and pass it explicitly:

```bash
ls ~/.claude/projects/ | grep -i <project-basename>
python3 <this-skill-dir>/scripts/recover.py /original/path --list-only --transcripts ~/.claude/projects/<dir>
```

`--list-only` prints every recoverable file with its last-event timestamp. Show this list to the user and confirm the scope before writing anything. Narrow with `--include <relative-prefix>` (repeatable, e.g. `--include .claude/`).

### 2. Reconstruct into the scratchpad

Never reconstruct directly into the destination. Write to a scratchpad directory first:

```bash
python3 <this-skill-dir>/scripts/recover.py /original/path --out <scratchpad>/recovered [--include ...]
```

Watch for `!!` warnings in the output (an edit whose `old_string` was not found means that file's reconstruction may be inexact — flag it to the user).

### 3. Restore to the original location

Compare the reconstruction with what exists at the original path, then apply these rules:

- **Destination directory missing** → recreate it, copy everything.
- **File missing at destination** → copy it (create parent directories as needed).
- **File exists and is identical** → skip silently.
- **File exists and differs** → NEVER overwrite silently. Show the user a short diff (`diff -u existing reconstructed | head -50`) and ask which version wins. The existing file may be newer than the last session snapshot.

```bash
diff -rq <scratchpad>/recovered /original/path
```

### 4. Report

List what was copied, what was skipped as identical, what awaits a decision, and any reconstruction warnings. Remind the user which files (if any) were requested but absent from every transcript.
