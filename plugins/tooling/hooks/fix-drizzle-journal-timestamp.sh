#!/bin/bash
# PostToolUse hook: after drizzle-kit generate, fix the `when` timestamp of the
# last journal entry so it is always Date.now() and strictly greater than all
# previous entries. Drizzle-kit migrate silently skips migrations whose `when`
# is <= max(created_at) already in DB — so monotonic timestamps are critical.

INPUT=$(cat)

# Only act on Bash tool calls
STDOUT=$(echo "$INPUT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data.get('tool_result', {}).get('stdout', ''))
" 2>/dev/null)

# Check if drizzle-kit generate was run (look for the success marker)
if ! echo "$STDOUT" | grep -q 'Your SQL migration file'; then
    exit 0
fi

# Find the journal file (search from git root)
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
JOURNAL=$(find "$GIT_ROOT" -path "*/drizzle/meta/_journal.json" -type f 2>/dev/null | head -1)

if [ -z "$JOURNAL" ] || [ ! -f "$JOURNAL" ]; then
    exit 0
fi

# Fix the last entry's `when` to be Date.now() and > all previous entries
python3 -c "
import json, time, sys

path = '$JOURNAL'
with open(path) as f:
    journal = json.load(f)

entries = journal.get('entries', [])
if len(entries) < 1:
    sys.exit(0)

now = int(time.time() * 1000)

# Find max when of all entries except the last
max_prev = 0
for e in entries[:-1]:
    if e['when'] > max_prev:
        max_prev = e['when']

last = entries[-1]
old_when = last['when']

# New when must be > max_prev and ideally = now
new_when = max(now, max_prev + 1)

if old_when != new_when:
    last['when'] = new_when
    with open(path, 'w') as f:
        json.dump(journal, f, indent=2)
        f.write('\n')
    print(json.dumps({
        'hookSpecificOutput': {
            'hookEventName': 'PostToolUse',
            'additionalContext': f'Drizzle journal timestamp fixed: {old_when} → {new_when} (ensures strictly increasing order for drizzle-kit migrate)'
        }
    }))
else:
    print(json.dumps({
        'hookSpecificOutput': {
            'hookEventName': 'PostToolUse',
            'additionalContext': f'Drizzle journal timestamp OK: {old_when} is already > max previous ({max_prev})'
        }
    }))
" 2>/dev/null

exit 0
