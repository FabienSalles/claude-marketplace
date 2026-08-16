# Write the analyzer, not the analysis

When a real question has no tool, produce a script that answers it and let the
script answer it. Never read files and report an impression. The reviewable unit
is the analyzer, not the conclusion: what a client receives is a command, a
committed script, a schema'd table, and the sample that was checked by hand.

This is not a stylistic preference on PHP. The tools most audit guides still name
are archived (`phpcpd`, github.com/sebastianbergmann/phpcpd, last push
2023-01-10; `phploc`, github.com/sebastianbergmann/phploc, last push 2025-04-12 —
both verified `archived=true` on 2026-08-16; GitHub exposes no archival date, so
the last push is the closest checkable proxy), CodeQL (github.com/github/codeql)
has never supported PHP, and the one off-the-shelf PHP call-map plugin is
version-blocked.
The gap where no tool answers is wide, and it is where an audit earns its fee.

Every tool named below was checked alive or dead on **2026-08-16**
(`gh api repos/OWNER/REPO --jq '.archived, .pushed_at'`); re-check before quoting
a version to a client. Claims that come from a project's own documentation, blog
or README are vendor-published and labelled where the weight matters, and
anything the research left unverified carries the word **unverified**. Shell
commands were executed on macOS (BSD userland) in a git repository. **PHP
commands and PHP snippets were not executed** — no PHP runtime was available —
so they are sourced, not tested here, and each carries its source.

## 1. When the pattern applies

Three checks, in order. All three must pass before a line of analyzer is written.

| Check | Pass | Fail |
|---|---|---|
| Does a maintained tool already answer it? | No tool, or the tool answers a neighbouring question | A tool answers it — run the tool |
| Is the answer countable? | One row per occurrence, `path:line` reachable | The answer is a judgement, a priority, a "should" |
| Can a human falsify a row in under a minute? | Open the file, read five lines, agree or disagree | Verifying one row needs the whole system in context |

**It does not apply when a tool exists.** Re-implementing PHPStan badly is the
dominant failure. Type-safety debt, dead code, distance to a modern target,
architecture violations, dependency CVEs, mutation score and complexity all have
maintained tools — see [deterministic-tools.md](deterministic-tools.md) before
concluding that nothing answers. A hand-rolled analyzer that duplicates a tool
inherits none of its rule coverage and all of the maintenance.

**It does not apply to questions that need intent rather than measurement.**
"Is this module important", "should this be deleted", "is this vulnerability
exploitable", "why was it built this way" are not measurable from the
repository. An analyzer that appears to answer them is answering a proxy
question and hiding the substitution. Those go to `open-questions.md`, addressed
to a named person.

**It does not apply when the row cannot be checked.** An analyzer whose output
cannot be sampled is an opinion with a CSV extension. If verifying one row means
reconstructing a runtime flow, the analyzer is measuring the wrong thing — narrow
the question until a row is falsifiable on sight.

The honest middle case: a tool answers a neighbouring question. Then run the
tool, and write the analyzer only for the delta. Record both, and say which
number came from which.

**Settle the metric before writing the analyzer.** This is the step OCSI took
first: the method — McCabe cyclomatic complexity, its fit checked against RPG III
and RPG IV in a preparatory dialogue — was settled before a single script was
generated (verified, section 5). Write the metric definition down in one
sentence, name what counts as one occurrence, and name at least one thing the
metric explicitly does not measure.
A correct analyzer of a wrong metric is the most expensive failure available
here, because everything downstream is reproducible and confidently wrong.

## 2. The PHP implementation: a PHPStan Collector, not a standalone script

PHPStan (github.com/phpstan/phpstan, 2.2.8, alive, last push 2026-08-15)
officially documented Collectors + `CollectedDataNode` + a custom
`ErrorFormatter` as a data-extraction mechanism on **2026-03-26**
(https://phpstan.org/blog/using-phpstan-to-extract-data-about-your-codebase —
verified HTTP 200 and fetched; the worked example emits a call map with
`callingClass` / `callingMethod` / `calledClass` / `calledMethod`, resolved
through `$scope->getMethodReflection()`). This is the sanctioned home for the
pattern in PHP, and it is barely known outside the PHPStan community.

Write the analyzer there rather than as a standalone script because the collector
inherits, for free:

- **type inference** — the callee is resolved, not name-matched;
- **container knowledge** — with `phpstan/phpstan-symfony`
  (github.com/phpstan/phpstan-symfony, 2.0.20, pushed 2026-08-14), service ids
  resolve from the compiled container;
- **file discovery, exclusions and caching** — the same paths the client's CI
  already agrees on;
- **the baseline** — today's rows freeze, and the next run is a diff;
- **output plumbing** — one `--error-format` flag switches the artifact shape.

A `nikic/PHP-Parser` script (github.com/nikic/PHP-Parser, v5.8.0 published
2026-07-04, verified alive) reproduces none of that. It matches names. On a
Symfony codebase, name-matching a call to `->find()` cannot tell a Doctrine
repository from a collection helper, so the false-positive rate lands in the
sample and the metric dies.

**Fall back to PHP-Parser only when `composer install` does not work** — a
read-only checkout, unresolvable dependencies, a PHP version too old to run
PHPStan. Note the trade-off in the artifact, and raise the sample size, because
every row now rests on a name. A codebase where `composer install` fails is
itself a finding for `risk-register.md`.

### The three components

The shape below is the target another Claude fills in. **Read the blog post
before writing the first class**: the exact interfaces, the service tags and the
formatter service naming come from there and from `vendor/phpstan/phpstan`, not
from this file. Nothing in this section was executed.

```php
final class QueryOutsideRepositoryCollector implements Collector
{
    public function getNodeType(): string
    {
        return MethodCall::class;
    }

    public function processNode(Node $node, Scope $scope): ?array
    {
        if (!$node->name instanceof Identifier) {
            return null;
        }

        $reflection = $scope->getMethodReflection($scope->getType($node->var), $node->name->name);
        if ($reflection === null) {
            return null;
        }

        return [
            'file' => $scope->getFile(),
            'line' => $node->getStartLine(),
            'caller' => $scope->getClassReflection()?->getName(),
            'callee' => $reflection->getDeclaringClass()->getName() . '::' . $reflection->getName(),
        ];
    }
}
```

1. **The Collector** visits one node type with the full `Scope`. It decides
   nothing and filters nothing beyond the node type and what it cannot resolve:
   it returns a row or `null`. Selection logic that lives here is invisible to
   the reader of the CSV.
2. **A `Rule<CollectedDataNode>`** receives every collected row at the end of the
   analysis, aggregates across files, and emits one error per surviving
   occurrence carrying the row as its payload. Cross-file logic belongs here and
   only here — a Collector cannot see another file.
3. **A custom `ErrorFormatter`** turns those errors into the artifact: CSV or
   JSON with the schema of section 3. PHPStan's built-in formatters are `table`,
   `raw`, `checkstyle`, `json`, `prettyJson`, `junit`, `github`, `gitlab`,
   `teamcity` (verified on phpstan.org/user-guide/output-format, corroborated
   against the `ErrorFormatter` directory in `phpstan-src`) — **there is no
   SARIF formatter**, and none of the nine emits a stable analysis schema, which
   is why the custom formatter is a component and not an option.

Register the collector, the rule and the formatter in a dedicated
`phpstan-analyzer.neon` extending the project's own config, so the client's
normal `phpstan analyse` is untouched. Run it as its own command and record that
command in the artifact. Sourced from the blog post, **untested here**:

```bash
vendor/bin/phpstan analyse -c phpstan-analyzer.neon --error-format=<registered-name> > out/<slug>.csv
```

Three traps that produce a silently wrong table. A Collector on a codebase
PHPStan cannot fully parse yields rows only for the files it reached — record the
analysed-file count next to the row count, and treat a gap as a caveat printed in
the report, not as a zero. Every `return null` in the collector is a dropped
occurrence, not a non-occurrence: a dynamic call (`$obj->$method()`) and an
unresolvable callee both disappear, so count them and publish the count beside
the table. And PHPStan findings shift between minor releases, so pin the version
in the sidecar (section 3): an unpinned number cannot be re-derived after the
engagement ends.

## 3. The output contract

Non-negotiable, every analyzer, every time. The reference design is OpenRewrite's
data tables (`-Drewrite.exportDatatables=true`, writing
`target/rewrite/datatables/<timestamp>/*.csv`; on Gradle, `exportDatatables = true`
inside the `rewrite { }` block — verified on
docs.openrewrite.org/authoring-recipes/data-tables). That mechanism is Java-only
and irrelevant to PHP; **the shape is what transfers**, and it is worth naming in
the deliverable, because it makes the format a borrowed industry convention
rather than a personal habit.

- **CSV or JSON. Never prose.** A paragraph is not re-runnable and cannot be
  diffed against next quarter's run.
- **A stable schema, declared before the run.** Column names are part of the
  contract; changing one is a new artifact, not an edit.
- **One row per occurrence.** Never one row per file, never a total. Totals are
  derived from the rows by a command the reader can re-run.
- **`path:line` is the key**, as the first two columns, `path` then `line`, and
  the path relative to the repository root. Every downstream command in section 5
  reads those two columns.
- **Provenance in the artifact**, not in the chat: tool versions, the analyzer
  file, the exact command, the commit sha, whether the tree was dirty, and a UTC
  timestamp.

A sidecar next to the table carries the provenance. Tested on macOS in this
repository:

```bash
printf '{\n  "analyzer": "%s",\n  "command": "%s",\n  "commit": "%s",\n  "tree": "%s",\n  "generated_at": "%s",\n  "rows": %s\n}\n' \
  "analyzers/query-outside-repository/Collector.php" \
  "vendor/bin/phpstan analyse -c phpstan-analyzer.neon --error-format=csv" \
  "$(git rev-parse HEAD)" \
  "$(git status --porcelain | grep -q . && echo dirty || echo clean)" \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  "$(tail -n +2 out/query-outside-repository.csv | wc -l | tr -d ' ')" \
  > out/query-outside-repository.meta.json
```

Add the tool versions the run depended on — on PHP, `composer show --locked
phpstan/phpstan phpstan/phpstan-symfony` (sourced, untested here). A version
string recalled from memory is not provenance.

Each question ships as one directory, and all of it is committed:

```
<artifacts>/analyzers/<question-slug>/
  Collector.php  Rule.php  Formatter.php
  tests/            fixture test, red/green (section 4)
  out/<slug>.csv    one row per occurrence
  out/<slug>.meta.json
  out/<slug>.sample.csv   the rows checked by hand (section 5)
```

The report cites the number, the command, and the sample. It never cites the
conversation.

## 4. The fixture rule

**An AI-authored analysis rule is syntactically valid and semantically wrong
often enough that none ships without a test.** This is documented, not
defensive. ast-grep's own post-mortem (github.com/ast-grep/ast-grep) on
generating rules with models records o3 hallucinating "with wild abandon",
inventing "syntax that looked more like CodeQL or jscodeshift, completely
ignoring the ast-grep documentation"; Gemini
borrowing Semgrep syntax and preferring "to invent its own ast-grep cli commands
rather than using the MCP tools"; and Claude 4 producing "syntactically valid
rules" while it "struggled with subtle semantic details that would make a rule
functionally correct" (quotes verified verbatim at
https://ast-grep.github.io/blog/ast-grep-agent.html; the post carries **no
visible publication date** — carry that caveat if it is cited).

The third failure is the dangerous one: valid, runnable, plausible, and
measuring something other than its name. Only a fixture catches it.

**Transformation rules — use the scaffold.** Rector's `custom-rule` command
generates the rule class, a PHPUnit test class and a before/`-----`/after
fixture, PSR-4 wired into `composer.json`. getrector.com/documentation/custom-rule
states verbatim "Since Rector 0.19.3 you can generate basic structure of your
custom rule with this command" (verified HTTP 200; Rector itself,
github.com/rectorphp/rector, verified alive at 2.6.2, 2026-08-12). Sourced,
untested here:

```bash
vendor/bin/rector custom-rule
```

**Measurement collectors — no scaffold exists.** Build the equivalent by hand,
and build it first:

1. Write the fixture directory before the collector: two or three files that
   **must** match, and — the ones that decide the metric — two or three that must
   **not**. The near-miss negative is the fixture that matters: a repository
   method called from a repository, a `new` on a value object, a concatenated SQL
   string built from a constant.
2. Commit the expected CSV, rows sorted, as the assertion target.
3. One test runs the analyzer over the fixture directory and compares the output
   to the expected CSV, byte for byte.
4. Red first. A test that has never failed proves nothing.

**Red/green is the gate, never "the diff looks right".** The whole market landed
on the same gate: Rector scaffolds it, Codemod (github.com/codemod/codemod)
exposes `run_jssg_tests` as an MCP tool so the loop runs inside the conversation,
and ast-grep-mcp (github.com/ast-grep/ast-grep-mcp) exposes
`test_match_code_rule` for exactly this (verified: the server registers four
tools — `dump_syntax_tree`, `test_match_code_rule`, `find_code`,
`find_code_by_rule`). ast-grep-mcp has no tagged release and installs straight
from git, so "the current version" is a moving target: record the commit.

When the collector changes, the fixture changes first.

## 5. The sampling protocol

The OCSI Group field report on auditing ~2,000 RPG programs (Pierre-Marie SERIS,
23/07/2026, https://www.ocsigroup.fr/auditer-la-qualite-dun-parc-de-programmes-rpg-avec-lia-retour-dexperience-terrain/
— verified: the method's fit was checked with the AI first, which then generated
one Python analyzer per language, and downloading the sources took longer than
generating and reviewing the scripts) names manual spot-checking the
indispensable control step. Verbatim:
*"Un échantillon de sources analysés a ensuite été vérifié manuellement pour
valider la fiabilité des métriques produites, une étape de contrôle qui reste
indispensable sur ce type de démarche."*

It is indispensable because it is the **only verification that is not the model
re-reading itself**. Intrinsic self-correction does not work: Huang et al. (ICLR
2024, arXiv 2310.01798) find LLMs "struggle to self-correct their responses
without external feedback, and at times, their performance even degrades after
self-correction"; Kamoi et al. (TACL 2024, vol. 12, 1417-1440,
aclanthology.org/2024.tacl-1.78/) conclude that "no prior work demonstrates
successful self-correction with feedback from prompted LLMs, except for studies
in tasks that are exceptionally suited for self-correction". A second AI pass
over the first is not a control.

Nor can reproducibility ever mean "the model said the same thing twice".
Anthropic's own API reference (platform.claude.com/docs/en/api/messages) states,
verbatim, *"Note that even with `temperature` of `0.0`, the results will not be
fully deterministic"*, and the Messages API exposes no seed parameter (verified).
Reproducible therefore means one thing only: **the committed analyzer re-runs and
produces the same table.**

The procedure. All commands tested on macOS in this repository.

**1. Freeze the output.** Commit `out/<slug>.csv` and its sidecar before drawing.
A sample of a table that later changed proves nothing.

**2. Fix N and the seed before looking at the rows.** 20 rows on a table of a few
hundred, 30 above a thousand — this file's defaults, not a sourced statistic.
Publish both so the sample can be redrawn by someone else.

**3. Draw a seeded shuffle.**

```bash
python3 -c "
import csv,sys,random
rows=list(csv.reader(open(sys.argv[1])))
head,body=rows[0],rows[1:]
random.Random(int(sys.argv[2])).shuffle(body)
w=csv.writer(sys.stdout); w.writerow(head); w.writerows(body[:int(sys.argv[3])])
" out/<slug>.csv 42 20 > out/<slug>.sample.csv
```

Where `python3` is absent — a locked client VM is the normal case, not the
exception — the awk fallback is reproducible **on the same machine and the same
awk build**, which is weaker; say so in the artifact:

```bash
{ head -1 out/<slug>.csv
  awk -v seed=42 'BEGIN{srand(seed)} NR==1{next} {print rand()"\t"$0}' out/<slug>.csv \
    | sort -n | head -20 | cut -f2-
} > out/<slug>.sample.csv
```

**4. Open every sampled `path:line` and read the surrounding lines.** The `cut`
assumes `path` and `line` are the first two columns, which is what section 3
requires.

```bash
cut -d, -f1,2 out/<slug>.sample.csv | tail -n +2 | tr ',' ':' > out/<slug>.locs
while IFS=: read -r f l; do
  printf '\n== %s:%s\n' "$f" "$l"
  awk -v n="$l" 'NR>=n-3 && NR<=n+3 {printf "%6d  %s\n", NR, $0}' "$f"
done < out/<slug>.locs
```

**5. Record a verdict per row**, in `verdict` and `reason` columns appended to the
sample file: `agree` or `disagree`, plus a one-line comma-free reason on every
disagreement. The reasons are the finding, not the rate.

**6. Publish the rate next to the number.** The header lookup keeps this working
whatever the analyzer's own columns are.

```bash
awk -F, 'NR==1 {for (i=1;i<=NF;i++) if ($i=="verdict") v=i; next} $0!="" {n++; if ($v=="disagree") d++} END {printf "%d/%d rows disagree = %.1f%%\n", d+0, n, (n?100*d/n:0)}' out/<slug>.sample.csv
```

A number published without its sample and its disagreement rate is an opinion
formatted as a measurement.

**7. Act on the disagreements.** One isolated disagreement is a defect to explain
in the artifact. Two or more sharing a cause means the analyzer measures
something other than its name: fix it, re-run the full analysis, redraw with a
**new** seed, and publish both rates when a metric is re-issued. Never patch the
sample.

What the sample does **not** prove: it verifies the analyzer, not the codebase.
A 0% disagreement rate means the number is trustworthy. It says nothing about
whether the number is alarming — that judgement is human, and it needs the
context the repository does not contain.

## 6. Catalogue — questions with no tool, one Collector each

Each is one collector, one fixture, one CSV. The *sample checks* line is the
false positive the metric dies on if nobody looks.

**Controllers building a Doctrine query outside a repository.**
*Emits:* `path,line,controller,method,query_kind` — one row per query builder or
DQL construction reached from a controller class.
*Sample checks:* the class really is a controller (routing attribute or
`extends AbstractController`), and the call is not delegating to a repository
method one frame down.

**Services instantiated with `new` instead of injected.**
*Emits:* `path,line,instantiating_class,instantiated_class,is_service`.
*Sample checks:* the instantiated class is a service in the compiled container
and not a DTO, a value object, an exception or a `DateTimeImmutable`. Without the
container cross-check this metric is noise.

**Raw SQL concatenating a variable.**
*Emits:* `path,line,class,method,sink` for every string concatenation or
interpolation reaching an SQL execution sink.
*Sample checks:* the interpolated part is not a constant or an enum case, and the
sink is a real execution path rather than a logger. Two rows of the same shape in
one method are one occurrence, not two — decide that in the Rule and document it
in the schema.

**Controllers bypassing the Form component.**
*Emits:* `path,line,controller,method,source` — direct `$request->request->get()`
and equivalents in an action that also persists.
*Sample checks:* the action really writes, and no validation happens through
another path (a DTO with constraints, a manual validator call).

**Duplication.** `phpcpd` is archived (verified `archived=true`, last push
2023-01-10). The only fresh option, `shipmonk-rnd/copy-paste-detector`
(github.com/shipmonk-rnd/copy-paste-detector), was created 2026-01-17 and its
detection approach is **unverified** — too young to anchor a client deliverable.
*Emits:* `hash,token_count,occurrences,paths` from a normalized PHP token stream
(comments stripped, variable names and literals canonicalised) hashed over a
sliding window.
*Sample checks:* 20 groups, both sides opened, confirming the same logic and not
two unrelated `getId()` bodies. Publish the window size with the number: it is
the parameter that decides the result.

**A resolved call graph.** `phpdepend/callmap` (github.com/phpdepend/callmap) is
a dead end, not merely stale: 3 stars, last push 2024-10-06, and 0.2.0 requires
`phpstan/phpstan: ^1.11`
against a current 2.2.8, so Composer refuses to install it alongside a modern
PHPStan (verified today: `archived=false`, `pushed_at=2024-10-06`).
*Emits:* the blog post's own example shape —
`callingClass,callingMethod,calledClass,calledMethod,path,line` — over
`MethodCall` / `StaticCall` / `New_`, aggregated in the `Rule<CollectedDataNode>`.
*Sample checks:* 20 edges, opening the call site, confirming the resolved callee
is what the container actually wires and not a parent class or an interface.

**A Symfony knowledge base from collectors.** One CSV per concern: controllers
(route, method, dependencies), entities (table, associations, repository),
services (id, class, tags), subscribers (event, priority, class).
*Sample checks:* cross-read against the framework's own compiled truth —
`debug:container --format=json`, `debug:router --format=json`,
`debug:event-dispatcher --format=json` (the `--format` option verified present on
those three commands in `framework-bundle` 7.3; note `debug:translation` declares
no such option). **Any disagreement between a static collector and the compiled
container is itself the finding**, and it belongs in the risk register.
The Java-only reference implementation of this idea is
`openrewrite/rewrite-prethink` (github.com/openrewrite/rewrite-prethink, v1.2.0,
2026-08-12), which writes CSV data tables into `.moderne/context/` as
agent-consumable context. There is no PHP equivalent; the architecture is
copyable.

## 7. The separation rule

The most rigorous published statement of this contract is Microsoft's — a
vendor-published rule set — in the `analyzing-architecture` skill of
`microsoft/github-copilot-modernization`
(github.com/microsoft/github-copilot-modernization, MIT, verified alive
2026-08-14; `plugins/github-copilot-modernization/skills/analyzing-architecture/SKILL.md`
was read directly during the research pass). Verbatim:

> "Evidence, never fabricated numbers: emit only values a tool actually computed,
> each with provenance. No invented composite scores, no made-up `confidence: 0.9`."

> "Source-loc as identifier: `source_loc: path:line` is the natural ID. Never
> invent stable IDs."

> "Analyze observes; design decides."

The same skill draws a **heuristic flag vs control gate** line: a threshold may be
recorded as a flag on a row, it may never decide which rows reach the artifact
set. An analyzer that filters on a magic number has buried a judgement inside a
measurement, and no sample can recover it. Emit the row, emit the value, let the
reader threshold.

Its executors are Java and .NET only, so nothing there runs on PHP — the
principles and the schemas are what is reusable, and the licence makes that
explicit.

Two consequences for this skill's artifacts. A composite "health score" is
forbidden unless every input and its weight is printed next to it — the
Maintainability Index is a composite with contested weightings, so quote it with
its inputs or not at all. And `confidence: 0.9` on a finding is a fabricated
number in the exact sense above: delete it, or replace it with the disagreement
rate of the sample that backs the finding.

## 8. One step never both authors and applies

**ast-grep's MCP server deliberately exposes no rewrite tool.** Its four
registered tools are `dump_syntax_tree`, `test_match_code_rule`, `find_code` and
`find_code_by_rule` (verified by reading `main.py`: exactly four `@mcp.tool()`
decorators). Dump, test, find. The agent may author and test; applying is a
separate, human-initiated CLI run. The absence is the design.

**OpenRewrite archived its own LLM-in-the-recipe experiment.**
`openrewrite/rewrite-generative-ai` (github.com/openrewrite/rewrite-generative-ai)
is archived (verified `archived=true`, last push 2026-07-22), with this
justification in its README, verbatim:

> "Because LLM outputs are non-deterministic, recipe results vary between runs —
> including producing incorrect changes or modifying code that should be left
> alone. At scale, this leads to unpredictable diffs that are difficult to
> review."

Moderne, the company behind OpenRewrite, had shipped the opposite design three
months earlier — its local MCP server, announced 2026-04-17 (vendor-published,
moderne.ai/blog/local-moderne-mcp-deterministic-tools-coding-agents), where the
agent drives deterministic recipes from outside — and kept that one. An
organisation that tried both is the strongest available evidence for the split.

For an analyzer, the rule is mechanical:

- The run that produces numbers **never writes to the tree**. A collector is
  read-only by construction; where a tool can transform, use its `--dry-run`
  (`rector process --dry-run --output-format=json` measures distance to a target
  and must never be applied — sourced, untested here).
- Authoring, testing and running are three commands, and the human starts each.
- **Never let the model produce the finding list.** Feed it a deterministic list
  to explain. SastBench (arXiv 2601.02941, github.com/RivalSecurity/sastbench —
  2,737 samples, 38 languages, 139 CWEs, PHP deliberately included) benchmarks
  agents *triaging findings a SAST tool already produced* — the easier half of the
  job — and measured the best configuration at precision 0.169, roughly five of
  six findings the best agent calls real being false. A model that fails at
  judging a deterministic list has no business generating one. Its job is the
  explanation next to a computed row, never the row.

## 9. Before it ships

An analyzer is not deliverable while any line here is false.

- The question failed none of the three checks in section 1, and no maintained
  tool answers it.
- The fixture exists, includes a near-miss negative, and failed before it passed.
- The output is CSV or JSON with a declared schema, one row per occurrence,
  `path:line` as the key.
- The sidecar carries the command, the analyzer path, the commit, the tree state,
  the pinned tool versions and a UTC timestamp.
- No threshold filtered rows out of the artifact.
- No composite score, no confidence number, no total without its rows.
- N, the seed, the sampled rows and the disagreement rate are published next to
  the number.
- The analyzer, the fixture, the table and the sample are committed together.
- Nothing in the run wrote to the client's tree.
