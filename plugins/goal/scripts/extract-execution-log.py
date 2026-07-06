#!/usr/bin/env python3
"""
Extract a PR-readable execution log from a Claude Code session JSONL.

Usage:
    extract-execution-log.py <work-id> [<transcript-path>]

`<work-id>` is the artifact id used by the goal workflow: `issue-<N>` for a
GitHub issue source, a Jira key like `ct-1234`, or a slug for a file/inline
source. It maps to `.claude/plans/<work-id>-spec.md`.

Reads the session transcript (provided explicitly, or auto-detected as the
most recently modified JSONL in ~/.claude/projects/<cwd-encoded>/ that
references the spec file). Writes a markdown summary to
    .claude/plans/<work-id>-execution-log.md

The output is intended to ship in the PR diff (or a manual commit) alongside
the implementation, so reviewers can audit what Claude did in the autonomous
/goal session without opening the raw JSONL.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


USER_INPUT_MAX = 300
ASSISTANT_TEXT_MAX = 500
BASH_COMMAND_MAX = 200
TOOL_INPUT_MAX = 120

# User messages we want to skip in the per-turn rendering — these are noise
# from the Claude Code harness, not real developer input.
NOISE_MARKERS = (
    "<system-reminder>",
    "<local-command-caveat>",
    "<command-name>",
    "<command-message>",
    "<local-command-stdout>",
)


def detect_workid_from_branch() -> str | None:
    """Derive the work-id from the current branch by matching existing spec
    files, so hyphenated ids (issue-42, ct-1234) resolve without ambiguous
    id-vs-slug parsing."""
    try:
        result = subprocess.run(
            ["git", "branch", "--show-current"],
            capture_output=True,
            text=True,
            check=False,
            timeout=5,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if result.returncode != 0:
        return None
    branch = result.stdout.strip()
    if not branch.startswith("feature/"):
        return None

    plans = Path(".claude/plans")
    if not plans.is_dir():
        return None
    for spec in plans.glob("*-spec.md"):
        work_id = spec.name[: -len("-spec.md")]
        if branch == f"feature/{work_id}" or branch.startswith(f"feature/{work_id}-"):
            return work_id
    return None


def find_session_jsonl(spec_relative: str) -> Path | None:
    """Find the most recently modified JSONL in the current project's claude
    dir that references the spec file. Fallback when transcript_path is not
    available (e.g. manual CLI invocation)."""
    project_key = str(Path.cwd()).replace("/", "-")
    claude_dir = Path.home() / ".claude" / "projects" / project_key
    if not claude_dir.exists():
        return None

    candidates: list[tuple[float, Path]] = []
    for jsonl in claude_dir.glob("*.jsonl"):
        try:
            with jsonl.open("r", encoding="utf-8") as f:
                # Quick scan for the spec reference; bail early once found
                for line in f:
                    if spec_relative in line:
                        candidates.append((jsonl.stat().st_mtime, jsonl))
                        break
        except OSError:
            continue

    if not candidates:
        return None
    candidates.sort(reverse=True)
    return candidates[0][1]


def truncate(text: str, limit: int) -> str:
    text = text.strip()
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def is_tool_result_only(msg_content) -> bool:
    """True when a `type:user` message contains nothing but tool_result blocks
    (i.e. it's a continuation of the current logical turn, not a new one)."""
    if not isinstance(msg_content, list) or not msg_content:
        return False
    return all(
        isinstance(b, dict) and b.get("type") == "tool_result"
        for b in msg_content
    )


def render_user_input(msg_content) -> str:
    if isinstance(msg_content, str):
        return msg_content
    if isinstance(msg_content, list):
        parts = []
        for block in msg_content:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
        return " ".join(parts)
    return str(msg_content)


def render_tool_use(name: str, inp: dict) -> tuple[str, str]:
    """Return (display_label, formatted_payload) for a tool_use block."""
    if name == "Bash":
        cmd = inp.get("command", "")
        desc = inp.get("description", "")
        cmd_short = truncate(cmd, BASH_COMMAND_MAX)
        if desc:
            return ("Bash", f"{truncate(desc, 80)} — `{cmd_short}`")
        return ("Bash", f"`{cmd_short}`")
    if name in {"Edit", "Write", "NotebookEdit"}:
        return (name, f"`{inp.get('file_path', '?')}`")
    if name == "Read":
        return ("Read", f"`{inp.get('file_path', '?')}`")
    if name == "Glob":
        return ("Glob", f"`{inp.get('pattern', '?')}`")
    if name == "Grep":
        return ("Grep", f"`{inp.get('pattern', '?')}` in `{inp.get('path', '?')}`")
    if name in {"TaskCreate", "TaskUpdate", "TaskList", "TaskGet"}:
        subject = inp.get("subject", "")
        status = inp.get("status", "")
        if subject:
            return (name, truncate(subject, 80))
        if status:
            return (name, f"status={status}")
        return (name, "")
    if name == "Agent":
        desc = inp.get("description", "")
        subagent = inp.get("subagent_type", "general-purpose")
        return ("Agent", f"[{subagent}] {truncate(desc, 80)}")
    if name == "WebFetch":
        return ("WebFetch", f"`{truncate(inp.get('url', '?'), 80)}`")
    if name == "WebSearch":
        return ("WebSearch", f"`{truncate(inp.get('query', '?'), 80)}`")
    if name == "ToolSearch":
        return ("ToolSearch", f"`{truncate(inp.get('query', '?'), 80)}`")
    # Default: show first 120 chars of input as JSON
    args = json.dumps(inp, ensure_ascii=False)
    return (name, truncate(args, TOOL_INPUT_MAX))


def parse_session(transcript_path: Path) -> list[dict]:
    """Return a list of turns, each with user input + assistant text + tool calls."""
    turns: list[dict] = []
    current: dict | None = None

    with transcript_path.open("r", encoding="utf-8") as f:
        for raw in f:
            try:
                d = json.loads(raw)
            except json.JSONDecodeError:
                continue

            ttype = d.get("type")
            ts = d.get("timestamp", "")
            msg = d.get("message", {})

            if ttype == "user":
                content = msg.get("content", "")
                # Pure-tool-result messages are continuations of the current
                # logical turn — they're the harness handing tool output back
                # to Claude. Don't start a new turn for them.
                if is_tool_result_only(content):
                    continue
                rendered = render_user_input(content)
                if any(marker in rendered for marker in NOISE_MARKERS):
                    # Don't start a new turn for harness-only noise.
                    continue
                current = {
                    "turn_start": ts,
                    "user_input": truncate(rendered, USER_INPUT_MAX),
                    "assistant_text_chunks": [],
                    "tools": [],
                }
                turns.append(current)
            elif ttype == "assistant" and current is not None:
                content = msg.get("content", [])
                if not isinstance(content, list):
                    continue
                for block in content:
                    if not isinstance(block, dict):
                        continue
                    btype = block.get("type")
                    if btype == "text":
                        current["assistant_text_chunks"].append(
                            block.get("text", "")
                        )
                    elif btype == "tool_use":
                        label, payload = render_tool_use(
                            block.get("name", ""), block.get("input", {})
                        )
                        current["tools"].append((label, payload))
    return turns


def slice_from_goal(turns: list[dict]) -> tuple[list[dict], bool]:
    """If a turn starts with `/goal`, drop everything before it so the log
    focuses on the autonomous session. Returns (turns_to_render, sliced)."""
    for i, t in enumerate(turns):
        if t.get("user_input", "").lstrip().startswith("/goal"):
            return turns[i:], True
    return turns, False


def write_log(
    out_path: Path,
    work_id: str,
    spec_relative: str,
    transcript_path: Path,
    turns: list[dict],
) -> None:
    scoped, sliced = slice_from_goal(turns)
    relevant = [
        t for t in scoped
        if t["tools"]
        or any(chunk.strip() for chunk in t["assistant_text_chunks"])
    ]

    tool_counts: Counter = Counter()
    bash_count = 0
    for t in relevant:
        for label, _ in t["tools"]:
            tool_counts[label] += 1
            if label == "Bash":
                bash_count += 1

    branch = subprocess.run(
        ["git", "branch", "--show-current"],
        capture_output=True, text=True, check=False, timeout=5,
    ).stdout.strip()
    head_sha = subprocess.run(
        ["git", "rev-parse", "--short", "HEAD"],
        capture_output=True, text=True, check=False, timeout=5,
    ).stdout.strip()

    lines: list[str] = []
    lines.append(f"# Execution log — {work_id}")
    lines.append("")
    lines.append(f"_Source transcript: `{transcript_path.name}`_  ")
    lines.append(
        f"_Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}_  "
    )
    lines.append(f"_Branch: `{branch}` at `{head_sha}`_  ")
    lines.append(f"_Spec: [`{spec_relative}`](./{Path(spec_relative).name})_")
    lines.append("")
    lines.append(
        "> This file is regenerated automatically at every Stop event while "
        "on a `feature/<work-id>-*` branch with a matching spec. It is meant "
        "to ship alongside the implementation (PR diff or manual commit) so "
        "reviewers can audit the autonomous /goal session without opening the "
        "raw JSONL."
    )
    lines.append("")
    lines.append("## Summary")
    lines.append("")
    if sliced:
        lines.append(
            "- Scope: from the first `/goal` command onward "
            "(pre-`/goal` turns omitted)"
        )
    lines.append(f"- Turns with activity: **{len(relevant)}**")
    if tool_counts:
        breakdown = ", ".join(
            f"{n}× `{label}`" for label, n in tool_counts.most_common()
        )
        lines.append(f"- Tool calls: {breakdown}")
    if bash_count:
        lines.append(f"- Bash invocations: **{bash_count}**")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## Turns")
    lines.append("")

    if not relevant:
        lines.append("_No tool activity recorded yet for this branch._")
    else:
        for i, t in enumerate(relevant, 1):
            lines.append(f"### Turn {i}")
            if t["turn_start"]:
                lines.append(f"_Started: {t['turn_start']}_")
            lines.append("")
            if t["user_input"]:
                # Indent as blockquote to keep markdown readable
                quoted = "\n".join(
                    f"> {line}" for line in t["user_input"].splitlines()
                )
                lines.append("**User input:**")
                lines.append("")
                lines.append(quoted)
                lines.append("")
            combined = " ".join(
                chunk for chunk in t["assistant_text_chunks"] if chunk.strip()
            ).strip()
            if combined:
                lines.append("**Claude's reasoning:**")
                lines.append("")
                lines.append(f"> {truncate(combined, ASSISTANT_TEXT_MAX)}")
                lines.append("")
            if t["tools"]:
                lines.append(f"**Tool calls ({len(t['tools'])}):**")
                lines.append("")
                for label, payload in t["tools"]:
                    lines.append(f"- `{label}` — {payload}")
                lines.append("")
            lines.append("")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    if len(sys.argv) < 2:
        work_id = detect_workid_from_branch()
        if not work_id:
            print(
                "Usage: extract-execution-log.py <work-id> [<transcript>]\n"
                "(no work-id given and no .claude/plans/<id>-spec.md matches the "
                "current feature/<id>-… branch)",
                file=sys.stderr,
            )
            return 1
    else:
        work_id = sys.argv[1]

    spec_relative = f".claude/plans/{work_id}-spec.md"
    if not Path(spec_relative).exists():
        print(f"Spec not found: {spec_relative}", file=sys.stderr)
        return 1

    if len(sys.argv) >= 3:
        transcript_path = Path(sys.argv[2])
    else:
        found = find_session_jsonl(spec_relative)
        if not found:
            print(
                f"No session JSONL references {spec_relative} in "
                f"~/.claude/projects/. Provide the transcript path explicitly.",
                file=sys.stderr,
            )
            return 1
        transcript_path = found

    if not transcript_path.is_file():
        print(f"Transcript not readable: {transcript_path}", file=sys.stderr)
        return 1

    turns = parse_session(transcript_path)
    out_path = Path(f".claude/plans/{work_id}-execution-log.md")
    write_log(out_path, work_id, spec_relative, transcript_path, turns)
    print(f"Wrote {out_path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
