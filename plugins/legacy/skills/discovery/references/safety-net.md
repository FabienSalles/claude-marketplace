# The safety net: pinning behaviour before touching it

The risk register mitigates untested hotspots with "characterization test". This
file is how that row gets executed on a PHP system nobody in the room has read.

A characterization test does not assert what the code *should* do. It records what
it *currently* does — bugs, quirks and 500s included — so that any change becomes a
visible diff instead of a hope. The pin has to be reproducible (same input, same
output, every run), explainable (the scrub rules are readable), and verifiable by
sampling (a human opens N recorded outputs and confirms they describe the system).
The reviewable unit is the harness, not the conclusion it produces.

Every tool below was checked on 2026-08-16 with the command shown next to it.
Re-check liveness before quoting anything to a client — three of these entries
exist here specifically because their public signal lies.

## The order, and why inverting it wastes the week

| # | Step | Deliverable | Gate before moving on |
|---|---|---|---|
| 1 | Inventory the observable surface | committed `routes.json` (or console commands, consumers, cron) | inventory diffs clean against the live app |
| 2 | Freeze the inputs | fixed DB state, fixed clock, fixed locale/timezone, seeded randomness | same request twice, byte-identical body |
| 3 | Pin the outputs | snapshots or recorded traffic, committed | first full run green on unmodified code |
| 4 | Prove the pin | Infection report on the pinned module | surviving mutants triaged, not counted |
| 5 | Change | the risk register's *safe first changes* | steps 3 and 4 re-run and still green |

Steps 3 and 5 are the ones that get inverted under deadline pressure, and the cost
is asymmetric: a change made before the pin cannot be distinguished afterwards from
a pre-existing defect, because the reference no longer exists. Step 2 is the one
that gets skipped, and it fails loudly one hour later — an unfrozen clock or an
autoincrement ID turns every snapshot red on the second run and the harness gets
abandoned as noisy. Step 4 is the one that gets skipped silently, which is worse:
a green suite that catches nothing is indistinguishable from a green suite that
catches everything, until production says otherwise.

## The PHP reality: the famous library is not installable

The approval-testing pattern arrived in PHP through the Java/.NET literature, which
points at ApprovalTests. In PHP that pointer is broken.

| | approvals/ApprovalTests.php | spatie/phpunit-snapshot-assertions |
|---|---|---|
| Repo | github.com/approvals/ApprovalTests.php | github.com/spatie/phpunit-snapshot-assertions |
| Last push | 2024-04-09 | 2026-06-26 |
| GitHub releases | none, ever (`releases/latest` → HTTP 404) | 5.4.0, 2026-04-29 |
| Packagist refs | `dev-Main` only — zero tagged versions | 74 tagged versions |
| Packagist downloads | 306,048 | 20,784,824 |
| Stars / licence | 34 / Apache-2.0 | 697 / MIT |

Installing the canonical library means pinning a production safety net to a moving
dev branch of a repository dormant for over two years. The sibling ports are all
maintained (ApprovalTests.Java pushed 2026-08-10, .Net 2025-10-07, .cpp
2026-02-11), so the ecosystem-wide reputation is earned — it just does not transfer
to PHP. Report it as a negative finding when a client's `composer.json` contains
`approvals/approval-tests` on `dev-Main`: the technique is right, the dependency is
a supply-chain risk with no release cadence to appeal to.

Re-verify both in one pass (tested on macOS, 2026-08-16):

```bash
gh api repos/approvals/ApprovalTests.php --jq '[.full_name,(.archived|tostring),.pushed_at]|join(" | ")'
gh api repos/approvals/ApprovalTests.php/releases/latest --jq '.tag_name'   # expect HTTP 404
curl -s https://packagist.org/packages/approvals/approval-tests.json \
  | python3 -c "import json,sys; d=json.load(sys.stdin)['package']; print('refs:', list(d['versions'].keys()))"
```

## The Symfony recipe: walk the routes, snapshot the responses

Three steps, in this order. Read from source on 2026-08-16, but not executed —
this machine has no PHP runtime, so treat every PHP fragment below as sourced and
unrun.

**1. The route inventory becomes a committed file, not a runtime query.** Enumerating
routes inside a data provider means booting the kernel before PHPUnit has started
the test, and it also means the harness silently follows the app: a route deleted
during the mission disappears from the suite instead of failing it.

The selection rule lives in a committed jq file so the same filter generates the
inventory and later checks it — `tests/Characterization/routes.jq`:

```jq
to_entries
| map(select(.key | startswith("_") | not))
| map(select(.value.method | test("GET|ANY")))
| map(select(.value.path | test("\\{") | not))
| map({(.key): .value.path})
| add
```

```bash
bin/console debug:router --format=json \
  | jq -S -f tests/Characterization/routes.jq \
  > tests/Characterization/routes.json
```

`--format=json` is declared by `RouterDebugCommand` (symfony/framework-bundle 7.3,
`InputOption` at line 56); the keys used here — `path`, `method` — come from
`JsonDescriptor::getRouteData()`, where `method` is the literal string `ANY` when the
route restricts nothing. The jq filter was run against a fixture of that exact shape
on macOS; the `bin/console` half is sourced, unrun. Parameterised routes are excluded
on purpose: they need chosen fixtures, and choosing them is a second, deliberate pass.

Drift between the committed inventory and the running app is then one command,
exit code 1 on divergence (tested against a fixture, both branches):

```bash
diff <(jq -S . tests/Characterization/routes.json) \
     <(bin/console debug:router --format=json | jq -S -f tests/Characterization/routes.jq)
```

**2. The harness.**

```php
namespace App\Tests\Characterization;

use PHPUnit\Framework\Attributes\DataProvider;
use Spatie\Snapshots\MatchesSnapshots;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class RouteCharacterizationTest extends WebTestCase
{
    use MatchesSnapshots;

    public static function routes(): iterable
    {
        $inventory = json_decode(
            file_get_contents(__DIR__.'/routes.json'),
            true,
            512,
            JSON_THROW_ON_ERROR,
        );

        foreach ($inventory as $name => $path) {
            yield $name => [$path];
        }
    }

    #[DataProvider('routes')]
    public function testResponseIsUnchanged(string $path): void
    {
        $client = static::createClient();
        $client->request('GET', $path);

        $response = $client->getResponse();

        $this->assertMatchesTextSnapshot(
            $response->getStatusCode()."\n".$this->scrub((string) $response->getContent()),
        );
    }
}
```

The status code is snapshotted, never asserted as 200. A legacy route that already
returns 500 is pinned as returning 500 — that is a correct characterization and a
risk-register row, not a bug to fix inside the harness. Fixing it during the pin
destroys the reference the whole exercise exists to establish.

Mechanics verified in the released 5.4.0 source, and each one changes how the
harness is operated:

- Snapshots land in `__snapshots__/` beside the test class (`SnapshotDirectoryAware`).
- The snapshot id is `getSnapshotId()` = short class name + PHPUnit's
  `nameWithDataSet()` + an incrementor. That is why the provider yields
  `$name => [$path]` and not `[$path]`: with unnamed data sets the id carries the
  numeric index, so inserting one route renames every snapshot after it and the
  whole pin silently re-baselines.
- The first run **creates** the snapshot and marks the test *incomplete* — a fresh
  harness reports incomplete, not green. Green on the very first run means the
  snapshots were already committed.
- Updates go through `vendor/bin/update-snapshots` or `UPDATE_SNAPSHOTS=true`.
  The `phpunit -d --update-snapshots` form widely documented online is legacy and
  emits a `Failed to set "--update-snapshots=1"` warning on PHPUnit 12.5.12+.
- **`CREATE_SNAPSHOTS=false` in CI.** Without it a missing snapshot is silently
  created and the run passes — a deleted pin then looks identical to a kept one.
- Requires PHP ^8.1 and PHPUnit ^9.6|^10|^11|^12|^13, and pulls symfony/serializer,
  symfony/property-access and symfony/yaml.

**3. The review rule that makes the pin worth anything.** Regenerating snapshots is
the one operation that can silently erase a regression, so it never travels in the
same commit as a source change. Listing the commits that broke that rule (tested on
this repository with substituted paths):

```bash
git log --format=%H -- src | while read -r sha; do
  git show --name-only --format= "$sha" | grep -q '__snapshots__' \
    && git log -1 --format='%h %s' "$sha"
done
```

An AI agent may write this harness, enumerate routes and propose scrub rules. It
must never be what approves a snapshot diff. Approval is the human gate, and a
snapshot approved by the same process that changed the code is not a pin.

## Scrubbers: the hardest part, and the licence trap behind the reference design

Every golden-master harness hits non-determinism within the hour: `_token` CSRF
values, session identifiers, autoincrement IDs, UUIDs, `created_at` renderings,
profiler tokens, cache-busted asset hashes, ordering that depends on a hash seed.
Scrubbing replaces those spans with stable placeholders before comparison.

The reference implementation is **Verify** (github.com/VerifyTests/Verify — MIT,
3,463 stars, pushed 2026-08-16). It is .NET-only and cannot be used on a PHP
mission; its documented engine semantics are what to copy, all read verbatim from
`docs/scrubbers.md` and `docs/guids.md` on 2026-08-16:

- **Counter-based placeholders, not constants.** A guid is replaced by a counter
  derived from that specific guid: the same value becomes `Guid_1` everywhere it
  appears, a different value becomes `Guid_2`. Identity structure survives the
  scrub, so a regression that swaps two IDs still fails. Replacing every UUID with
  the literal string `UUID` erases exactly that class of defect.
- **Scrubbers run on the final string**, immediately before comparison — not on the
  object graph, not at render time.
- **Quarantine**: text produced by a replacement is never re-examined by other
  *engine* scrubbers, so a placeholder cannot be re-scrubbed into something else.
  The docs carve out one exception: legacy `AddScrubber` registrations run
  afterwards and can still modify a replacement.
- **Single-line rule**: a match may never contain a line break, and text is newline
  normalised (`\r\n` and `\r` → `\n`) before scrubbing.
- **Ordering is engine-determined, not registration-determined.** A hand-rolled PHP
  chain applies in array order instead, so two patterns that can match the same span
  make the output depend on their position. Keep the patterns disjoint.

The licence trap belongs in any dependency review, and a LICENSE-file-only audit
misses it entirely. Verify's README carries verbatim: *"Upcoming: Open Source
Maintenance Fee. From August 2026, commercial organizations and government agencies
using Verify's official binary releases will be asked to pay a small subscription
fee (from $10/month). The source code remains open and free, and individuals,
non-revenue organizations, CI, forks, and local development are unaffected."* The
SPDX field still reads MIT. Read the README, not only the licence file:

```bash
gh api repos/VerifyTests/Verify/readme --jq '.content' | base64 -d | grep -i 'Maintenance Fee'
```

In PHP there is no scrub engine to install. Two placement options: scrub the string
before asserting (shown above), or implement `Spatie\Snapshots\Driver`
(`serialize(mixed $data): string`, `extension(): string`, `match($expected, $actual)`)
and normalise inside `serialize()` when the same rules must apply to every
assertion. The counter form, patterns validated against a sample with Python `re`
but the PHP itself unrun:

```php
private function scrub(string $html): string
{
    $seen = [];

    $html = preg_replace_callback(
        '/\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/i',
        static function (array $match) use (&$seen): string {
            $key = strtolower($match[0]);
            $seen[$key] ??= 'Guid_'.(count($seen) + 1);

            return $seen[$key];
        },
        $html,
    );

    return preg_replace(
        [
            '/name="_token" value="[^"]+"/',
            '/\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/',
            '/sf-dump-\d+/',
        ],
        ['name="_token" value="Token_1"', 'DateTime_1', 'sf-dump-N'],
        $html,
    );
}
```

Two failure modes, both silent:

- **Over-scrubbing erases the finding.** A rule broad enough to swallow a whole
  `<table>` makes every future change to that table invisible. Every scrub pattern
  gets its own before/after fixture test, exactly like the analyzer fixture rule in
  [deterministic-tools.md](deterministic-tools.md).
- **Scrubbing to nothing erases the shape.** Replacing a match with an empty string
  hides the disappearance of the element itself. Always replace with a placeholder,
  and assert the occurrence count when the count carries meaning (a form that loses
  its CSRF field must fail, not scrub clean).

Scrub as little as possible. Prefer removing the non-determinism at the source:
`symfony/clock`'s `MockClock` and `ClockSensitiveTrait::mockTime()` for time,
`dama/doctrine-test-bundle` (github.com/dmaicher/doctrine-test-bundle — MIT, v8.6.0
of 2026-01-21) for per-test transaction rollback, a fixed `APP_ENV=test`, a pinned
locale and timezone. A frozen input needs no scrub rule, and a scrub rule is a
permanent blind spot in the pin.

## Record-replay when the code has no seams

Snapshot assertions need a test harness that can boot the application. A legacy PHP
app with no autoloading discipline, no DI container and no test bootstrap may not
give one cheaply. Capture at the network layer instead.

**Keploy** (github.com/keploy/keploy — Apache-2.0, 18,402 stars, v3.6.15 of
2026-08-16, pushed the same day) records real API calls, database queries and
streaming events and replays them as tests with the captured dependency responses
as mocks. Its README states verbatim: *"Because Keploy intercepts at the network
layer (eBPF), it works with any language, framework, or runtime—no SDK required."*
That is the decisive property on a takeover: zero code changes, no seam required,
and the recording answers the one question no static analyzer can — what the system
actually does under production traffic.

Three caveats to carry into any recommendation, all from the project's own README
read on 2026-08-16:

- PHP is one badge in a sixteen-language wall illustrating language-agnosticism.
  It is not a named support tier. Do not present it as first-class PHP support.
- *"Some of the dependencies are not open-source by nature because their protocols
  and parsings are not open-sourced. It's not supported in Keploy enterprise."*
- **Time Freezing** — the feature that makes replays deterministic despite
  timestamps — links to `keploy.io/docs/keploy-cloud/time-freezing/`, i.e. it is
  documented as a Cloud capability. Vendor-published; whether the OSS CLI provides
  it is unverified.

Behaviour under PHP-FPM process models and Doctrine connection pooling is unmeasured
in the research and unverified here. Spike it on the client's stack before promising
it in a proposal.

**GoReplay** (github.com/probelabs/goreplay) is the cautionary entry, not a
recommendation, and it is the cleanest available proof that `pushed_at` must never
be a liveness signal. Tested, 2026-08-16:

```bash
gh api repos/probelabs/goreplay --jq '.pushed_at'
gh api 'repos/probelabs/goreplay/commits?per_page=1' --jq '.[0].commit.author.date'
gh api repos/probelabs/goreplay/releases/latest --jq '[.tag_name,.published_at]|join(" | ")'
```

Output: pushed `2026-01-27`, newest default-branch commit `2025-04-05`, last stable
release `1.3.3` of `2021-10-06` — 19,310 stars, and the repository silently moved
from `buger/` to `probelabs/`. A dependency-liveness check built on `pushed_at`
alone classifies as actively maintained a project whose last stable release predates
the pushed date by more than four years. Check the archived flag, the newest commit
on the default branch and the newest release, and say which one is being reported.

## Differential testing: the legacy system is its own oracle

When a rewrite runs beside the original, no expected output has to be written down
at all — the old system produces it. This is the industrial pattern, and Google
Cloud's Dual Run documentation states it plainly
(docs.cloud.google.com/mainframe-assessment-tool/docs/modernize-validate —
vendor-published, read verbatim on 2026-08-16): *"Dual Run helps reduce the risk
of the transition. It lets you run workloads simultaneously on your existing
mainframe and on Google Cloud, comparing outputs like daily reports and online
transactions"*, yielding data on *"functional equivalence, performance, and
stability"*. Mainframe-only as a product; the pattern maps directly onto a Symfony
migration by mirroring production requests to both stacks and diffing responses.

The documentation never defines what magnitude of divergence counts as a failure.
That threshold is the single most consequential parameter of a parallel run, and it
is the auditor's to define and write down before the first comparison.

The hard part is separating real divergence from inherent non-determinism, and the
best published answer is **Diffy**'s three-way design: send each request to the
candidate build *and* to two instances of the current build, then subtract the noise
the two controls disagree on. What survives is attributable to the candidate. No
hand-written scrub rules, and no assumption that the noise was anticipated.

The repository pair is itself the lesson: `twitter-archive/diffy` is **archived**
(`archived=true`, last push 2020-07-01) and carries 3,813 stars, while the
maintained continuation `github.com/opendiffy/diffy` has 1,458 — 2.6x fewer on the
signal most tool choices are made with. `opendiffy/diffy` is a separate repository,
not a GitHub fork (`fork=false`, no parent, created 2018-04-26), so the archived
original carries none of its activity. It was pushed 2026-05-18, dependency bumps
only, and its newest release is `23.09.11.00` of 2023-09-11. Adopt the design
before adopting either tool: three-way comparison is reimplementable behind any HTTP
proxy, without standing up the JVM service either repository ships (GitHub reports
Scala for the archived original, Java for the continuation).

One limit belongs in any report that leans on record-replay or parallel run: the
evidence is only as strong as the behavioural coverage of the captured traffic.
A window of production traffic does not contain the year-end batch, the refund path
nobody triggers, or the undocumented exception branch. State the capture window and
what it demonstrably did not exercise, next to the pass rate.

## Prove the pin: mutation, not coverage

A characterization suite that passes proves nothing about its own sensitivity.
Mutation testing injects faults and reports which ones the suite fails to detect.

**Infection** (github.com/infection/infection — BSD-3-Clause, 2,233 stars, 0.34.2
of 2026-08-07) is the PHP engine. Sourced from the 0.34.2 source, unrun here:

```bash
vendor/bin/infection run src/Billing --threads=max --min-msi=0 --logger-summary-json=infection.json
```

Path scoping is now a **positional argument**. `--filter` is deprecated since 0.34.0
and emits *"The \"--filter\" option is deprecated since 0.34.0 and will be removed in
future versions. Use positional arguments instead: infection `<filter>`"* — a stale
reference that still teaches `--filter` produces a deprecation on the first run
(`SourceFilterOptions` line 135). The `run` verb is not optional here:
`Application::setDefaultCommand('run')` is registered without the
single-command flag, so a bare `vendor/bin/infection src/Billing` resolves the path
as a command name. `--threads=max` is documented in-source as auto-calculated. Scope
to one module: a whole-repo run on a large legacy codebase is prohibitively slow,
and that cost is precisely why ACH's targeted-mutant idea matters below.

Run it with `--min-msi=0` first. The number is a measurement, not a gate, until
there is a baseline to defend; setting a threshold before knowing the score turns
the first run into a red build and the tool gets removed.

The industrial precedent is Meta's, and it is the strongest citation available
because it is a published shift, not a vendor claim. TestGen-LLM
(arXiv:2402.09171, FSE 2024) filtered LLM-generated tests on compile → pass
reliably → **increase coverage**; its successor ACH (arXiv:2501.12862, FSE 2025)
abandoned coverage as the objective and adopted **mutation killing** instead:
generate a small number of targeted mutants of a chosen fault class, then generate
tests that kill them. Applied to 10,795 Android Kotlin classes across 7 platforms,
producing 9,095 mutants and 571 privacy-hardening tests, 73% accepted by engineers.
Meta also published where its own pipeline is weak — the agent screening equivalent
mutants scores precision 0.79 / recall 0.47, reaching 0.95 / 0.96 only after
pre-processing. Publishing a recall of 0.47 for a production component is what makes
the paper citable in a way no vendor benchmark is.

The consequence for the deliverable: *"the suite covers 62% of lines in billing"*
says a line executed. *"The suite fails to detect 41 of 96 injected faults in
billing, listed by mutator and location"* says what breaks without anyone noticing.
The second is a finding a CTO can fund; the first is a number that survives any
amount of useless testing.

## The honest warning about generated tests

A model asked to write tests for legacy code with no specification available does
the only thing it can: it infers the expected behaviour from the implementation in
front of it, records the current output as the reference — including the bug — and
the suite goes green. The green is real. It means the code still does exactly what
it did, which is the correct outcome for a characterization test and a *false*
outcome for anything labelled "test coverage of correct behaviour". The two are
indistinguishable in a report unless the distinction is written down.

CodeSpecBench (arXiv:2604.12268, submitted 2026-04-14) quantifies the gap: the best
model reaches only a **20.2% pass rate** on repository-level executable behavioural
specification generation, and the authors conclude *"specification generation is
substantially more challenging than code generation"* and *"strong coding
performance does not necessarily reflect deep understanding of intended program
semantics"*. A model that writes code well is not thereby a model that can state
what existing code guarantees.

What this forbids in a report:

- Never present a coverage percentage obtained after AI test generation as evidence
  of safety. It measures how much code was executed while its current behaviour was
  being blessed — including whatever is wrong with it.
- Never let a generated test be described as validating a business rule unless a
  human named the rule first. Absent a specification, the test validates the code
  against itself.
- Do quote the mutation delta, the scrub inventory, the capture window, and the
  sample of approved snapshots a human actually opened. Those four are measurements.

Meta's own numbers make the filtering cost concrete: TestGen-LLM improved 11.5% of
the classes it was applied to, with 73% of surviving recommendations accepted by
engineers — after a filter chain discarded every candidate that did not compile,
did not pass reliably, or did not increase coverage. That chain is trivially
reproducible in PHP with three PHPUnit runs and no model in the loop: parse, pass N
times against unmodified code, then kill a mutant. The model proposes, the tooling
disposes, the human approves.

## Back to the risk register

Each pinned module upgrades its risk-register row from "untested hotspot" to
"pinned, MSI known", and that is what promotes it into *safe first changes*: the
short list where work can start Tuesday without fear. A module is safe to change
when it has an inventory, a green pin on unmodified code, a mutation score with its
surviving mutants triaged, and a scrub inventory a reviewer has read. Anything
missing one of the four stays in the register with the reason named — never as a
percentage, always as the missing artifact.
