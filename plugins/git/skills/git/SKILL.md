---
name: git
description: ACTIVATE for any git or PR operation — create/choose a branch, open or update a PR, "est-ce mergé ?", choose a base, rebase/merge, commit, push, force-push, worktree, cherry-pick, fork. ACTIVATE on 'branche', 'PR', 'merge', 'rebase', 'base main', 'fork', 'gh pr', 'commit', 'push', 'mets à jour', 'est-ce mergé'. Covers Fabien's transverse git conventions — fetch before reasoning on remote state, never ask what a command answers, branch/commit discipline, English conventional commits without AI trailer, PR (French title, ultra-succinct body, draft for WIP, fork targets parent), force-push and worktree guardrails, manual index mode. DO NOT use for Eres-specific fork conventions (see Eres marketplace).
version: 1.0.0
---

# git — git & PR discipline (transverse conventions)

Rules for any git / PR operation. Apply them **by default**, without asking
again. The core of the skill is **ref freshness** (§A): the costliest mistake is
reasoning on stale remote state.

## A. Freshness & source of truth ← core

- **Fetch first.** Any decision that depends on remote status (branch merged? PR
  open? base up to date?) starts with `git fetch <remote> --prune`, then reads
  `origin/*`, `gh pr list`, `gh pr view` on the fresh result. Local tracking refs
  are **stale** until a fetch.
- **Never rely on memory or session context** for git state: a branch may have
  moved, a PR may have merged since. Re-verify at time T.
- **Squash merges**: a local commit is not an ancestor of `main` even when its
  work is there. Verify by **content** (file / feature present on `origin/main`)
  and by the **merged PR title**, not just `git branch --contains <sha>`.
- **"mets à jour" (update) = an explicit order**: fetch every relevant remote
  (+ `composer install` / install deps if a dependency branch moved), on **each**
  repo involved (multi-repo), before continuing.

## B. Don't ask what is verifiable

Exhaust `git` / `gh` / `ls` before any question. A question is legitimate only
about an **intent** the state does not reveal (e.g. "one combined PR or two
stacked PRs?"), and only **after** observing the real, fresh state. Never ask the
developer what a command answers.

## C. Branch discipline

- Check `git branch --show-current` before any amend / commit / push.
- New branch **from a fresh base**: `git switch -c <x> origin/main` **after** a
  fetch, never from a lagging local.
- New commit > `--amend` by default. `--amend` only when the commit is local and
  unpushed, or on explicit request.
- Move a misplaced commit: cherry-pick onto the right fresh base, verify
  build / tests, no destructive reset without a request.

## D. Commits

- Message in **English**, format `type(scope): summary`, conventional commits.
- Type reflects the observable change: a behavior change is `feat` / `fix`,
  **not** `refactor` even when the diff is mostly restructuring. `refactor` = no
  bug fixed and no behavior changed.
- **No AI trailer**: never `Co-Authored-By: Claude`, never "Generated with…".
  The commit is attributed to the developer alone.

## E. Pull requests

- **Update on `main` BEFORE** opening (rebase, linear history), never a PR from a
  lagging branch:

  ```bash
  git fetch upstream main
  git rebase upstream/main        # rebase, not merge
  ```

- **French title**, conventional prefix kept, concise, no ticket ref unless
  requested. This is a **personal** preference (transverse across your repos).

  ```
  feat(payment-information): découpe des modes de paiement par typologie d'offre
  ```

- **Ultra-succinct description**: only the **non-guessable** (decisions,
  per-case behavior, deliberate out-of-scope). A few bullets max. No spec dump,
  no exhaustive "Why / Rules / To review" sections. No em dash `—` mid-sentence
  (an AI tell).
- **Always `--body-file <file>`**: `gh`'s `--body -` does not read stdin and
  writes a literal "-".
- **Fork**: the PR targets the **parent**, base `main`:

  ```bash
  gh repo view <owner>/<repo> --json parent
  gh pr create --repo <parent> --base main --head <fork-owner>:<branch> \
    --draft --title "<French title>" --body-file <file>
  ```

  If the repo has no parent, it **is** the upstream.
- **WIP / multi-iteration batch → `--draft`.**

## F. Force-push

- `git push --force` is **forbidden**. `--force-with-lease` only on explicit
  request (reverting a local commit, a requested rebase / squash), never by
  default. `--force-with-lease` refuses to push if the remote moved since the
  last fetch — that is the anti-clobber guardrail.

## G. Worktrees

No auto worktree without an explicit request.

## H. Manual mode (index)

Under the **manual** policy, **never** `git add` content nor `git reset` /
`git restore` the index: the `git-add-empty` hook already sets the intent-to-add
(` A`) so new files show in the diff without being staged. Let the developer
stage and review themselves.

## Anti-patterns (❌ / ✅)

- ❌ Read `origin/main` without fetching → conclude "retrieve not merged" (false)
  → ask the developer a wrong question.
  ✅ `git fetch` first → the commit `024ef9a … (#158)` is visible → act.

- ❌ `git branch -r --contains <sha>` alone for "is it merged?": misses
  squash-merges.
  ✅ + verify the file / feature actually present on `origin/main`.

- ❌ Create a branch from a lagging local.
  ✅ `git switch -c <x> origin/main` after a fetch.

- ❌ Partial cross-repo reference in a PR body (`#55`, "the contract PR").
  ✅ Always the full form **`owner/repo#N`** — a bare `#N` is ambiguous outside
  the current repo.

- ❌ State a dependency PR's status from session memory ("it's merged").
  ✅ Verify at time T with `gh pr view <owner/repo#N>` — a PR may have merged or
  been closed since.

### Canonical example — PR description (PR #160 incident)

❌ Before (written by Claude, too verbose):

```md
- Submit valide → POST `CreatePaymentInformationRequest` vers individual.contract.service, PRG vers l'étape origine des fonds.
- Endpoints POST contract-first (dépendance : PR #55 individual.contract.service). Sauvegarde idempotente (delete-then-insert côté serveur).
- Bump `individual-contract-service-contracts` : requests structure pro par typologie (Spirica / Swisslife).
- Périmètre : ELV + SPK. SWL (type de compte + structure) à l'itération suivante.
```

✅ After (fixed by Fabien):

```md
- Submit valide → POST `CreatePaymentInformationRequest` vers individual.contract.service, redirection vers l'étape origine des fonds.
- Bump `individual-contract-service-contracts`
- Périmètre : ELV + SPK. SWL (type de compte + structure) à l'itération suivante.
```

Rules illustrated: resolved dependency → bullet **removed** (not fixed);
implementation details of the **other** repo → removed; detail guessable from
the diff → removed (`Bump X` alone is enough); jargon (PRG) → plain word.
