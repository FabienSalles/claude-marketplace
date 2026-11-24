# Reproduction protocol — one subagent per finding

## Driving the campaign with `goal`

Set the objective with the `goal` command so stopping is blocked until every finding has a
verdict: `/goal reproduce every finding in the risk register on the local instance, prove
or refute each, assign real criticality, report false positives and shadow zones`. Then fan
out subagents. The Stop-hook keeps the run honest; the subagents do the work.

## Wave batching

Do not launch all findings at once against one instance. Group into waves so load and
shared-state collisions stay bounded:

- **Wave A — runtime** findings that need the live instance (access control, injection,
  stored XSS, destructive operations). Highest value; run first, once the instance responds.
- **Wave B — code-anchored** findings confirmed by reopening the anchor plus a read-only DB
  or filesystem check.
- **Wave C — tool-measured** findings: rerun the one command (`composer audit`, `git
  shortlog`, the test suite) — cheap, often inline rather than a dedicated agent.
- **Wave D — judgments**: not binary-reproducible; re-read against the stated criterion.

Within a wave, read-only reproductions parallelize freely. Mutating ones (role change,
destructive import, stored-content injection, entity merge) each **create their own
namespaced test data** (suffix every row with the finding id, e.g. `-r13`), touch only that
data, and **clean up** at the end. Never delete shared seed data.

## Per-finding subagent brief (template)

Give each subagent a tight, single-finding brief. Keep the common block short:

```
Verify one audit finding and PROVE or REFUTE it locally. Instance already up.
- App dir: <path to the running checkout>
- Web: <base url> (client <x>), admin host <y>, creds <u>/<p>
- curl with --resolve <host>:<port>:127.0.0.1 ; authenticated session: POST <login route>
  with -c jar then -b jar
- Container: <exec command> ; DB: <how to query read-only>
- Running code is in <module dir>; the anchor may cite the delivery path (same files).
- READ-ONLY on the knowledge-base dir. Create only namespaced test data (suffix -<id>),
  delete no shared seed, clean up your own data at the end.
- Report to scratchpad/verif-<id>.md AND hand back. Max ~500 words.

FINDING #<id> — <one line>. Anchors: <path:line…>. Hypothesis: <what it claims>.
TO DO: 1) reopen anchors, cite exact lines of the mechanism. 2) reproduce with the
smallest benign witness (a marker file, a read of your own row) — no destructive or
exfiltrating payload; stop once shown. 3) if the route/precondition is unreachable, fall
back to a rigorous static trace and return PARTIAL.
Verdict: CONFIRMED / PARTIAL / REFUTED + decisive command+output + path:line + numbered repro.
```

Pick the subagent model for cost: a capable mid-tier model handles concrete reproduction
well; reserve the top model for the orchestration.

## Benign-witness protocol (security findings)

- **Command injection / RCE**: inject a marker that writes a witness file (e.g. redirect the
  output of an identity command to a temp path) and confirm the file appeared. Never run a
  destructive, networked, or data-reading-beyond-test command. Delete the witness.
- **Access-control bypass (IDOR, privilege escalation)**: show the **pair** — the request
  refused without the bypass, accepted with it — on your own test objects/accounts. Restore
  any changed state.
- **Anonymous read**: curl without a cookie; show the HTTP code and a corroborating body
  excerpt. If the seed is empty, say the leak needs a populated instance (PARTIAL).
- **Stored XSS**: store a benign marker payload, prove it is persisted raw and re-served
  unescaped; deduce execution from the sink (no browser needed). Restore the field.
- **Destructive operation**: operate only on your own namespaced rows; show the before/after
  state (SELECT) that proves the destruction.
- **Secret exposure**: show the field is readable; truncate any real value to first-4…last-4
  in the report. Never paste a full secret.

## What the orchestrator does with the results

Collect verdicts, keep a running tally, and watch for findings that recoup each other (a
reproduction that needed a second flaw to work is itself evidence). When done: fold the
verdicts into the risk register's verification section, score in Phase 4, and clean up all
test data (list what was created so cleanup is complete). Leave the instance functional.
