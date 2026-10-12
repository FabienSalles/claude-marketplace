# Artifact root rules shared by the goal skills

Use the returned absolute `root`, `plans` and `runs` as `<artifact-root>`, `<plans>`
and `<runs>` in every destination and handoff. Stop on resolver errors. The priority
is process/container `GOAL_ROOT_PATH`, project-root `.env.local`, project-root `.env`,
then `.goal/` only on absence. Relative values resolve from the Git project root;
absolute values and spaces remain intact. Never read unrelated environment values.

Discover identifiers only in `<plans>`. On a miss, ask for the full path and wait;
never search an old provider directory or fetch a substitute source. Explicit paths
select exactly that file; missing or unreadable files fail clearly. Existing selected
plans stay in place and are updated there. New associated documents go in `<plans>`
and include `Source plan: <absolute selected plan path>`. Preserve every command and
path embedded in locked plans; never migrate artifacts or rewrite historical documents.
Old history requires `--runs-path <absolute work-id history directory>`.

Git ignore rules determine planning-document versioning. Tracked, ignored and external
plans are supported; a tracked plan must be clean at launch and the gate owns its ticks.
Before launching, prepare exact exclusions in project `.gitignore` for the resolved
in-repository `<runs>/`.
Do not ignore the whole artifact root or require plans to be ignored. External paths
need no repository exclusion. Write project-relative, root-anchored ignore entries,
escaping Git pattern characters so the exclusions name only those exact paths.
Never write `.git/info/exclude`.
