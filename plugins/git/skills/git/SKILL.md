---
name: git
description: ACTIVATE for any git or PR operation — create/choose a branch, open or update a PR, "est-ce mergé ?", choose a base, rebase/merge, commit, push, force-push, worktree, cherry-pick, fork. ACTIVATE on 'branche', 'PR', 'merge', 'rebase', 'squash', 'fixup', 'historique', 'base main', 'fork', 'gh pr', 'commit', 'push', 'mets à jour', 'est-ce mergé'. Covers Fabien's transverse git conventions — fetch before reasoning on remote state, never ask what a command answers, branch/commit discipline, English conventional commits without AI trailer, history shape (reshape before the first push, fixup over fix-on-fix, ask before pushing a branch that repairs itself, reshape unasked under a non-manual policy), PR (English title and body unless the repository's CLAUDE.md asks otherwise; ticket link first, own-PR description only and NEVER a comment or review reply without explicit per-time consent, ultra-succinct body kept to what a reviewer cannot read off the diff, decision log mined from the plan, terse lower-case register, screenshots for anything that renders, one branch one PR, draft for WIP, fork targets parent), force-push and worktree guardrails, manual index mode. DO NOT use for Eres-specific fork conventions (see Eres marketplace).
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
- **Chain with `&&`, never with `;`.** When a git command only makes sense if the
  one before it succeeded — fetch then branch, add then commit, commit then push —
  `&&` is what carries that condition; `;` runs the second command over the first
  one's failure. Either chain with `&&` or issue separate calls. `git fetch --prune
  && git switch -c <x> origin/main` is one safe command; the same line with `;`
  cuts the branch from a lagging base whenever the fetch fails, and a pipe
  (`git fetch | tail`) hides the exit code of the fetch itself.
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

## E. History shape — reshape before the first push

The commits on a branch are what a reviewer reads. They should describe **the change**,
not the session that produced it. A commit that exists only because an earlier commit on
the same branch was wrong documents the author's process, and forces the reviewer to
replay the branch to find out what the final state even is. It belongs folded into the
commit it repairs.

The test is per commit, not per branch: **would anyone want to bisect to this state?**
That is what sets how many commits a branch keeps. Collapsing four real units into one
loses as much as leaving eleven repairs strewn across the log.

- **Reshape before the first push.** Unpushed history is free to rewrite and needs no
  force. After the push the same reshape costs a `--force-with-lease` and an explicit
  request (§G), so the cost of a messy log is paid at the moment you decide to push, not
  before.
- **Decide at commit time, not at the end.** A commit that repairs an earlier one on the
  branch is written `git commit --fixup <sha>` and settled with
  `git rebase --autosquash <base>`. Reconstructing afterwards what fixed what is guesswork.
- **Before pushing a branch that becomes a PR, or marking a PR ready**, read
  `git log --oneline <base>..HEAD`. If it carries repairs to its own commits, say so,
  propose the reshaped list, and **ASK**. Pushing first and raising it after puts the
  developer in front of a force-push they never chose.
- **Non-manual policy → reshape without asking.** Under `commit` / `commit+pr` — an
  unattended `/goal:supervise` run — there is nobody to answer, and that mode produces this
  shape by construction: one commit per iteration plus whatever repaired it. Reshaping is
  part of shipping, and it lands before the single push at the end, so it never forces.
- **Never rewrite across a merge**, nor any commit already on `main` or that someone may
  have branched from.

## F. Pull requests

- **Update on `main` BEFORE** opening (rebase, linear history), never a PR from a
  lagging branch:

  ```bash
  git fetch upstream main
  git rebase upstream/main        # rebase, not merge
  ```

- **Push the base before opening the PR when the branch was cut from unpushed commits.**
  The mirror case of the one above, and the one that gets missed: a PR's diff is computed
  against the **remote** base, so commits sitting on a local `main` the remote has not seen
  are counted as the branch's own and land in the PR. Check it before creating:

  ```bash
  git log --oneline origin/main..HEAD    # anything here that is not this branch's work?
  ```

  Pushing the base is a standard fast-forward push and needs no separate permission when the
  commits on it were made at the developer's request — §D already made them, and the personal
  `CLAUDE.md` states plain `git push`, `main` included, is the normal workflow on a solo repo.
  **Having the authorisation and flagging the problem instead of applying the fix is not
  caution — it is handing back a command you were already meant to type**, and it ships a
  pull request whose diff misleads the reviewer in the meantime.

- **Title and body in English**, conventional prefix kept, concise. Another language only
  when the repository's own `CLAUDE.md` (or `.claude/CLAUDE.md`) asks for one — that file
  is the single override point, and its absence means English.

  Asking in French does not make the artifact French. The audience of a pull request is
  whoever reads the repository, and English is the default because it is the language
  the largest number of them share.

  ```
  fix(goal): stop handing the implementer a path out of its own tree
  feat(payment-information): découpe des modes de paiement par typologie d'offre
  ```

  The second form needs a `CLAUDE.md` declaring French. Commit messages are English
  regardless (§D) — the override reaches the PR title and body, nothing else.

- **The ticket link is the first line** when the work comes from one: bare, alone, no
  label wrapped around it. One click gives the reviewer the whole context; buried in a
  sentence or omitted, they go looking for it.

- **Ultra-succinct description**: only the **non-guessable**. A few bullets max. No spec
  dump, no exhaustive "Why / Rules / To review" sections. No em dash `—` mid-sentence
  (an AI tell).

  Test every candidate line with **"can a reviewer read this off the diff?"** — if yes,
  cut it. That one question removes file lists, test commands, restated function names and
  section headings, which is most of what a first draft is made of.

  What survives the test falls in four families:
  - a **decision** taken between two defensible options — which one was taken, under the
    same compression as below
  - **behaviour per case** that the code applies but never announces
  - a **deviation from the ticket** — done though never asked, or refused though implied.
    Densest line in any body. State the deviation, **not the case for it**: an anchor of a
    few words earns its place ("comme sur swisslife", "as the other providers do"), a
    sentence of rationale does not. The argument belongs to the plan; a reviewer who
    disagrees asks
  - **deliberate out-of-scope**, so nobody files it as a gap

  Excluded even when they pass the test: **the test suite, tooling, internal hygiene**.
  Deleting a test is a genuine decision with a rationale nobody can guess, and it still does
  not go here — the body carries **product behaviour**, and the reviewer sees the deletion in
  the diff anyway. Say it in your reply instead.

- **Mine the plan, not only the diff.** When the work came from a spec, a plan or a grill,
  its decision log already holds the non-guessable: those arbitrations were settled during
  planning and evaporate unless the PR carries them. Read it before writing the body — the
  diff alone cannot give you those lines. Take **which** decision was made, never the
  reasoning that produced it; that stays in the plan, which is where anyone reopening it
  will look.

- **Register**: short bullets, lower case, no closing punctuation, no marketing. A single
  `PS :` at the end for what spills beyond this PR — a dependency on another repo's PR, the
  iterations still to come on a multi-iteration branch, a known follow-up.

- **A visible change needs visible proof.** Screenshots for anything that renders, one per
  state the change introduces, each under a short line naming the case — `Exemple cas de
  base`, `Exemple cas avec la date`. They go after the `PS :`, at the very end. When you
  cannot produce them, name in your reply the states that are missing and why, rather than
  ship a UI PR whose reviewer has to run the app to see the point. Never a silent gap.

- **One branch, one PR.** `gh pr view --json number` on the branch before creating: if it
  finds one, push and update that body instead. A second PR on the same branch leaves two
  that every later push moves at once.

- **Always `--body-file <file>`**: `gh`'s `--body -` does not read stdin and
  writes a literal "-".

- **Writing to a PR: the body, never a conversation.** Two different acts, and only one of them is
  ever covered by a policy:

  - **The description** of a PR **the developer authored** — allowed under `commit+pr`, it is part of
    shipping the work. Never touch the description of anyone else's PR, and never one the developer
    did not open.
  - **Any comment, review, reply in a thread, or `gh pr review`** — **ASK EVERY TIME, and wait for a
    clear yes.** No exception, no "it is only a follow-up", no "the reviewer is waiting". The single
    alternative to asking is the developer telling you explicitly to answer — "réponds-lui",
    "laisse une review". A `commit+pr` policy authorises the body and **nothing else**: it says how
    the work ships, not that you may speak to a colleague under the developer's name.

  These posts carry the developer's identity to a real person who answers them. Getting it wrong is
  not a bad diff, it is words the developer never wrote, in a conversation they did not choose to
  have. When a review comment calls for an answer, put the answer **in your reply to the developer**
  and let them decide whether it goes out.

- **Never re-push a body from a local draft — §A applies to PR bodies too.** `gh pr edit
  --body-file` **replaces** the body, it does not merge. The developer edits the description
  on GitHub: they trim a line, they attach the screenshots you could not produce. A scratchpad
  file written before that is stale state, and pushing it destroys their work silently — no
  conflict, no warning, and the images are the part nobody can rewrite from memory. Before
  every edit:

  ```bash
  gh pr view <n> --json body --jq .body > body.md   # the remote is the source of truth
  ```

  Amend **that** file, then push it back. Their wording wins over your draft: a line they
  shortened was shortened on purpose.
- **Fork**: the PR targets the **parent**, base `main`:

  ```bash
  gh repo view <owner>/<repo> --json parent
  gh pr create --repo <parent> --base main --head <fork-owner>:<branch> \
    --draft --title "<title, English unless the repo overrides it>" --body-file <file>
  ```

  If the repo has no parent, it **is** the upstream.
- **PR opened ON the fork itself → sync the fork's `main` BEFORE `gh pr create`.** When the
  PR's base is the fork's own `main` (not the parent's), fast-forward it from the parent
  first, or the PR counts every commit the fork is behind as its own (13 commits / 70 files
  for a 2-commit branch):

  ```bash
  git fetch --prune && git push <fork-remote> <parent-remote>/main:main   # fast-forward only
  ```

  The order is load-bearing: GitHub pins the merge-base at PR **creation** (`base.sha`) and
  never recomputes it when the base branch advances afterwards — syncing after the fact
  changes nothing on the open PR. Recovery for an already-open PR: flip its base away and
  back, which forces the recompute:

  ```bash
  git push <fork-remote> <parent-remote>/main:refs/heads/tmp-rebase-base
  gh pr edit <n> --repo <fork> --base tmp-rebase-base
  gh pr edit <n> --repo <fork> --base main
  git push <fork-remote> :refs/heads/tmp-rebase-base
  ```
- **WIP / multi-iteration batch → `--draft`.**

## G. Force-push

- `git push --force` is **forbidden**. `--force-with-lease` only on explicit
  request (reverting a local commit, a requested rebase / squash), never by
  default. `--force-with-lease` refuses to push if the remote moved since the
  last fetch — that is the anti-clobber guardrail.

## H. Worktrees

No auto worktree without an explicit request.

## I. Manual mode (index)

Under the **manual** policy, **never** `git add` content nor `git reset` /
`git restore` the index: the `git-add-empty` hook already sets the intent-to-add
(` A`) so new files show in the diff without being staged. Let the developer
stage and review themselves.

## Anti-patterns (❌ / ✅)

- ❌ Read `origin/main` without fetching → conclude "retrieve not merged" (false)
  → ask the developer a wrong question.
  ✅ `git fetch` first → the commit `024ef9a … (#158)` is visible → act.

- ❌ Answer a reviewer in a PR thread because their comment called for an answer. The post goes out
  under the developer's name, to a colleague who will reply to it, and nobody authorised it.
  ✅ Put the answer in the reply to the developer, say the thread is waiting, and ASK before posting.

- ❌ Keep the PR body in a scratchpad file and re-push it with `gh pr edit --body-file` at
  every iteration. The developer had trimmed a bullet and attached two screenshots in the
  meantime; the push wipes both without a word.
  ✅ `gh pr view <n> --json body --jq .body` first, amend that, push it back.

- ❌ `git branch -r --contains <sha>` alone for "is it merged?": misses
  squash-merges.
  ✅ + verify the file / feature actually present on `origin/main`.

- ❌ Create a branch from a lagging local.
  ✅ `git switch -c <x> origin/main` after a fetch.

- ❌ `git fetch --prune ; git checkout -b <x>` — the `;` runs the branch creation
  even when the fetch failed, which is exactly the case the fetch was there to
  prevent. The `fetch-first` hook blocks this form for that reason.
  ✅ `git fetch --prune && git checkout -b <x>`, or two separate commands.

- ❌ Partial cross-repo reference in a PR body (`#55`, "the contract PR").
  ✅ Always the full form **`owner/repo#N`** — a bare `#N` is ambiguous outside
  the current repo.

- ❌ State a dependency PR's status from session memory ("it's merged").
  ✅ Verify at time T with `gh pr view <owner/repo#N>` — a PR may have merged or
  been closed since.

- ❌ Review a branch, commit each batch of fixes on top, then push on "vas-y" without a
  word about the log. The developer gets eleven commits, five of which repair the other
  six, and a reshape now needs a force-push they never asked for.
  ✅ Commit the fixes as `--fixup` of what they repair; at push time show
  `git log --oneline <base>..HEAD`, propose the reshaped list, and ask before pushing.

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
