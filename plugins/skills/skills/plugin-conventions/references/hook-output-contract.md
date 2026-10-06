# Hook output contract

What a `command` hook reads on stdin, and which of its channels reaches Claude or the user, per the
[hooks reference](https://docs.claude.com/en/docs/claude-code/hooks). The five rules that cause
silent failures are summarized in `SKILL.md`; this file holds the full tables.

## stdin

One JSON object. Every event sends `session_id`, `transcript_path`, `cwd` and `hook_event_name`.
Most events also send `permission_mode`, but not all: each event's example in the reference shows
its fields. Then:

| Event | Extra fields |
|-------|--------------|
| `PreToolUse` | `tool_name`, `tool_input`, `tool_use_id` |
| `PostToolUse` | The same, plus `tool_response` (never `tool_result`) and an optional `duration_ms`. For `Bash`, `tool_response` is the object `{stdout, stderr, interrupted, isImage}`, not a string |
| `SessionStart` | `source`, the value its matcher reads |

`tool_input.file_path` of `Read`, `Write` and `Edit` is always absolute: Claude Code expands `~` and
relative paths before the hook runs.

## Exit code

| Exit | Effect |
|------|--------|
| `0` | Success. stdout is parsed as JSON only when it starts with `{` and ends with `}`. stderr goes to the debug log only: neither Claude nor the user sees it |
| `2` | Blocking error, with the per-event effect below, and no JSON field overrides the block. The message is the reason of a JSON blocking decision when there is one, otherwise stderr |
| Any other | On most events, a schema-valid JSON object on stdout decides alone and the hook is not reported as an error. Without one, the error is non-blocking: the action proceeds, so `exit 1` enforces nothing. `WorktreeCreate` and `WorktreeRemove` fail on any non-zero exit. A command that cannot start (a wrong path, an unquoted root containing a space) exits 127, which leaves the hook silently disabled |

## Per event

| Event | Plain stdout at exit 0 | Exit 2 | JSON on stdout |
|-------|------------------------|--------|----------------|
| `PreToolUse` | Not added to Claude's context | Blocks the call. The reason is the JSON decision's reason, otherwise stderr | `hookSpecificOutput` with `hookEventName`, `permissionDecision` (`allow`, `deny`, `ask` or `defer`), `permissionDecisionReason`, `updatedInput`, `additionalContext`. The top-level `decision`/`reason` pair is deprecated for this event (`block` maps to `deny`) |
| `PostToolUse` | Not added to Claude's context | stderr is shown to Claude | Top-level `decision: "block"` with `reason`, still current, puts the reason next to the tool result; `hookSpecificOutput.additionalContext` adds context for Claude |
| `SessionStart` | Added to Claude's context | stderr is shown to the user only | `hookSpecificOutput.additionalContext` for Claude, `systemMessage` for the user |

- `UserPromptSubmit`: plain stdout is added to Claude's context; the top-level `decision`/`reason`
  pair is still current. `UserPromptExpansion` and `PostModelSwitch` also add plain stdout to the
  context.
- `Stop`: exit 2 keeps Claude from stopping; the top-level `decision`/`reason` pair is still current.
- `Notification`: its exit code and stderr are ignored.

## JSON output

- Pick one approach per hook: exit codes alone, or exit 0 plus JSON.
- Print exactly one JSON object, built with an encoder (`jq -n --arg …`, Python's `json.dumps`),
  never by string interpolation. A quote or a newline in a value breaks it, and stdout that looks
  like JSON but does not parse becomes a non-blocking hook error whose content is dropped.
- A field at the wrong level, such as a top-level `permissionDecision` or `additionalContext`, is
  ignored silently; the debug log only notes the unrecognized keys.
- Fields every event accepts: `continue`, `stopReason`, `systemMessage`, though some events discard
  them.
- `additionalContext`, `systemMessage`, `initialUserMessage` and plain stdout are each capped at
  10,000 characters. A longer one is saved to a file in the session directory and replaced by its
  path and a preview of up to 2,000 characters, and Claude is not asked to read that file.
- All matching hooks run in parallel, and for `PreToolUse` `deny` wins over `defer`, `ask` and
  `allow`.
- A `command` hook times out after 600 s by default, 30 s on `UserPromptSubmit`, `PreModelSwitch`
  and `PostModelSwitch`, and 10 s on `MessageDisplay`; `SessionEnd` hooks share a 1.5 s budget that
  a plugin hook's own `timeout` does not raise. A hook that reaches its timeout is cancelled and its
  output discarded: on `PreToolUse` it does not block, and on `UserPromptSubmit` its
  `additionalContext` never reaches Claude.
