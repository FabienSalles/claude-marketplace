#!/usr/bin/env python3
"""
PreToolUse hook: warn when writing raw date/time instantiation in production code.

Projects should use an injectable Clock abstraction (ClockInterface, ClockPort,
PSR-20 ClockInterface, etc.) instead of calling new Date() / new DateTime()
directly. This makes code testable and deterministic.

Detects:
  JS/TS: new Date()                      (no args = "now")
  PHP:   new DateTime()                  new \\DateTime()
         new DateTimeImmutable()         new \\DateTimeImmutable()
         Carbon::now()                   Carbon::today()

Allowed in:
  - Test files
  - Clock implementations
  - Domain models, DTOs, value objects, entities, enums
"""

import json
import re
import sys

data = json.load(sys.stdin)
inp = data.get("tool_input", {})
file_path = inp.get("file_path", "")
content = inp.get("new_string", inp.get("content", ""))

if not file_path or not content:
    sys.exit(0)

# Only check source code files
if not re.search(r"\.(tsx?|jsx?|php)$", file_path, re.IGNORECASE):
    sys.exit(0)

# ── Allowlist ──────────────────────────────────────────────────────

# Test files
if re.search(
    r"(/tests/|/test/|/__tests__/"
    r"|\.test\.[jt]sx?$|\.spec\.[jt]sx?$"
    r"|Test\.php$|\.test\.php$)",
    file_path,
):
    sys.exit(0)

# Clock implementations (any language)
if re.search(r"(clock\.[a-z]+$|/[Cc]lock[./])", file_path, re.IGNORECASE):
    sys.exit(0)

# Domain models, DTOs, entities, value objects, enums
if re.search(
    r"(/models?/|/dto/|/entit(?:y|ies)/"
    r"|/value-objects?/|/enums?/)",
    file_path,
    re.IGNORECASE,
):
    sys.exit(0)

# ── Detection ──────────────────────────────────────────────────────

lang = None
pattern = None

# JS/TS: new Date() with no arguments
if re.search(r"new\s+Date\(\s*\)", content):
    lang = "JS/TS"
    pattern = "new Date()"

# PHP: new DateTime() / new \DateTime() / new DateTimeImmutable() / ...
if re.search(r"new\s+\\?Date(?:Time|TimeImmutable)\s*\(\s*\)", content):
    lang = "PHP"
    pattern = "new DateTime() / new DateTimeImmutable()"

# PHP: Carbon::now() / Carbon::today()
if re.search(r"Carbon::(now|today)\s*\(\s*\)", content):
    lang = "PHP"
    pattern = "Carbon::now() / Carbon::today()"

if not lang:
    sys.exit(0)

# ── Warning ────────────────────────────────────────────────────────

msg = {
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "additionalContext": (
            f"\u26a0\ufe0f **`{pattern}` detected in production code ({lang})**\n\n"
            "Production code must use an injectable Clock abstraction to obtain "
            "the current date/time.\n\n"
            f"**Rule:** `{pattern}` is forbidden in repositories, services, "
            "use cases, controllers, and features. It is allowed only in:\n"
            "- The concrete Clock implementation (SystemClock, RealClock, ...)\n"
            "- Tests\n"
            "- Domain models / DTOs / value objects\n\n"
            "**Action:** inject the Clock via the constructor or through the "
            "project's DI container."
        ),
    }
}
print(json.dumps(msg))
