#!/usr/bin/env python3
import argparse
import json
import re
import sys
from pathlib import Path

PROJECTS_DIR = Path.home() / ".claude" / "projects"
EXCLUDED = ("node_modules/", ".git/", "__pycache__/", "vendor/", ".venv/")


def munge_candidates(path):
    return {re.sub(r"/", "-", path), re.sub(r"[^A-Za-z0-9]", "-", path)}


def discover_transcript_dirs(target):
    candidates = munge_candidates(str(target).rstrip("/"))
    dirs = [d for d in PROJECTS_DIR.iterdir() if d.is_dir() and d.name in candidates]
    return dirs


def strip_line_numbers(text):
    out = []
    for line in text.split("\n"):
        i = line.find("\t")
        if i > 0 and line[:i].strip().isdigit():
            out.append(line[i + 1:])
        elif line.strip() == "":
            out.append("")
        else:
            return None
    return "\n".join(out)


def relevant(path, prefix, includes):
    if not path.startswith(prefix):
        return False
    rel = path[len(prefix):]
    if any(part in rel for part in EXCLUDED):
        return False
    if rel.endswith(".pyc"):
        return False
    if includes:
        return any(rel == inc or rel.startswith(inc.rstrip("/") + "/") for inc in includes)
    return True


def collect_events(transcript_dirs, prefix, includes):
    events = {}
    seq = 0
    for tdir in transcript_dirs:
        for f in sorted(tdir.rglob("*.jsonl")):
            with open(f, errors="replace") as fh:
                for line in fh:
                    seq += 1
                    try:
                        rec = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    ts = rec.get("timestamp", "")
                    msg = rec.get("message") or {}
                    content = msg.get("content")
                    if isinstance(content, list):
                        for block in content:
                            if not isinstance(block, dict) or block.get("type") != "tool_use":
                                continue
                            name = block.get("name", "")
                            inp = block.get("input") or {}
                            p = inp.get("file_path", "")
                            if not relevant(p, prefix, includes):
                                continue
                            if name == "Write" and "content" in inp:
                                events.setdefault(p, []).append((ts, seq, "write", inp["content"]))
                            elif name == "Edit" and "old_string" in inp:
                                events.setdefault(p, []).append((ts, seq, "edit", [inp]))
                            elif name == "MultiEdit" and isinstance(inp.get("edits"), list):
                                events.setdefault(p, []).append((ts, seq, "edit", inp["edits"]))
                    tur = rec.get("toolUseResult")
                    if isinstance(tur, dict):
                        fi = tur.get("file")
                        if isinstance(fi, dict):
                            p = fi.get("filePath", "")
                            c = fi.get("content")
                            if relevant(p, prefix, includes) and isinstance(c, str):
                                start = fi.get("startLine", 1)
                                total = fi.get("totalLines")
                                if start in (0, 1) and (total is None or fi.get("numLines") == total):
                                    events.setdefault(p, []).append((ts, seq, "read", c))
    return events


def replay(evs):
    state = None
    warnings = []
    for ts, _, kind, payload in evs:
        if kind == "write":
            state = payload
        elif kind == "read":
            stripped = strip_line_numbers(payload)
            state = stripped if stripped is not None else payload
        elif kind == "edit":
            if state is None:
                warnings.append(f"edit @ {ts} before any full snapshot, skipped")
                continue
            for e in payload:
                old, new = e.get("old_string", ""), e.get("new_string", "")
                if old and old in state:
                    state = state.replace(old, new) if e.get("replace_all") else state.replace(old, new, 1)
                elif old:
                    warnings.append(f"edit @ {ts} not applicable (old_string not found)")
    return state, warnings


def main():
    parser = argparse.ArgumentParser(description="Rebuild files from Claude Code session transcripts")
    parser.add_argument("target", help="original absolute project/workspace root the files lived under")
    parser.add_argument("--out", help="directory to write reconstructed files into (mirrors the tree relative to target)")
    parser.add_argument("--transcripts", action="append", default=[], help="explicit transcript directory (repeatable); default: auto-discover in ~/.claude/projects")
    parser.add_argument("--include", action="append", default=[], help="relative path prefix to restore (repeatable); default: everything under target")
    parser.add_argument("--list-only", action="store_true", help="list recoverable files without writing")
    args = parser.parse_args()

    target = args.target.rstrip("/")
    prefix = target + "/"
    tdirs = [Path(t) for t in args.transcripts] or discover_transcript_dirs(target)
    if not tdirs:
        print(f"no transcript directory found in {PROJECTS_DIR} for {target}", file=sys.stderr)
        print("hint: ls ~/.claude/projects/ | grep -i <project-basename>, then pass it via --transcripts", file=sys.stderr)
        sys.exit(1)
    for t in tdirs:
        print(f"transcripts: {t}")

    events = collect_events(tdirs, prefix, args.include)
    if not events:
        print("no recoverable file found (no Write/Edit/full-Read event matches)", file=sys.stderr)
        sys.exit(1)

    if not args.list_only and not args.out:
        print("--out is required unless --list-only", file=sys.stderr)
        sys.exit(2)

    count = 0
    for p, evs in sorted(events.items()):
        evs.sort(key=lambda e: (e[0], e[1]))
        rel = p[len(prefix):]
        last_ts = evs[-1][0]
        if args.list_only:
            print(f"{rel}  [last event @ {last_ts}, {len(evs)} events]")
            count += 1
            continue
        state, warnings = replay(evs)
        if state is None:
            continue
        dest = Path(args.out) / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        if state and not state.endswith("\n"):
            state += "\n"
        dest.write_text(state)
        count += 1
        print(f"{rel}  [last event @ {last_ts}]")
        for w in warnings:
            print(f"    !! {w}")
    verb = "listed" if args.list_only else "reconstructed"
    print(f"{count} files {verb}")


if __name__ == "__main__":
    main()
