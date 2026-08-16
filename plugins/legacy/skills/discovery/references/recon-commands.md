# Recon commands

All commands are BSD/macOS-safe (no `grep -P`, no GNU-only flags). Run them from
the target repository root. Skip any block whose tool is absent — note the absence
in `recon.md` instead of installing tools on a client machine without asking.

## Stack detection

```bash
# Build/dependency manifests present
ls composer.json package.json pom.xml build.gradle go.mod Gemfile requirements.txt pyproject.toml *.csproj 2>/dev/null

# PHP: framework + version constraints
[ -f composer.json ] && cat composer.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('require'))"

# JS/TS: framework + engines
[ -f package.json ] && python3 -c "import json; d=json.load(open('package.json')); print(d.get('engines')); print(list(d.get('dependencies',{}).items())[:30])"

# Installed versions are truth, not constraints
[ -f composer.lock ] && python3 -c "import json; d=json.load(open('composer.lock')); [print(p['name'], p['version']) for p in d['packages'] if any(k in p['name'] for k in ('symfony/framework','php','laravel/','doctrine/orm'))]"
node -e "const p=require('./package-lock.json').packages; Object.entries(p).slice(1,30).forEach(([n,v])=>console.log(n,v.version))" 2>/dev/null
```

Check the EOL status of the runtime and framework majors found (endoflife.date
covers PHP, Node, Symfony, Laravel, .NET, Django, Rails…). An EOL runtime is
always a top-3 risk-register entry.

## Size and language split

```bash
# cloc if available, otherwise a portable approximation
cloc . --vcs=git 2>/dev/null || git ls-files | sed -n 's/.*\.//p' | sort | uniq -c | sort -rn | head -15

# Biggest source files (complexity proxy #1)
git ls-files -z '*.php' '*.ts' '*.js' '*.py' '*.java' '*.cs' '*.rb' | xargs -0 wc -l 2>/dev/null | sort -rn | head -25
```

## Entry points

```bash
# Symfony — note: bin/console boots the app's kernel, i.e. executes project code;
# on an untrusted checkout, grep the routing config/attributes instead
bin/console debug:router 2>/dev/null | head -60
bin/console list 2>/dev/null | sed -n '/Available commands/,$p' | head -40
grep -rnE 'AsMessageHandler|implements MessageHandlerInterface' src/ | head -20

# Express/Nest/Next
grep -rnE '@(Controller|Get|Post)\(' src/ 2>/dev/null | head -40
grep -rnE 'router\.(get|post|put|delete)' --include='*.js' --include='*.ts' src/ 2>/dev/null | head -40

# Generic: routes files, cron, queues
git ls-files | grep -i -e 'route' -e 'crontab' -e 'consumer' -e 'worker' -e 'command' | head -30
```

Count them: this number decides whether Phase 2 runs sequentially or with parallel
Explore agents (threshold ~30).

## Data layer

```bash
# Migrations (the schema truth)
git ls-files | grep -i -e 'migration' -e 'migrations/' | head; ls migrations/ 2>/dev/null | tail -5

# ORM entities/models
grep -rlE '#\[ORM\\Entity|@Entity|extends Model|models\.Model' src/ app/ 2>/dev/null | head -30

# Table count without a DB connection: CREATE TABLE across migrations
git grep -i -h 'create table' -- '*migration*' '*Migration*' 2>/dev/null | sort -u | wc -l
```

## Tests and CI

```bash
ls phpunit.xml* vitest.config.* jest.config.* pytest.ini .github/workflows/ .gitlab-ci.yml 2>/dev/null
# Test file count vs source file count — a first coverage proxy
echo "tests: $(git ls-files '*Test.php' '*test*.ts' '*_test.py' '*spec*.ts' | wc -l) / src: $(git ls-files 'src/*' 'app/*' | wc -l)"
```

If a coverage report can be generated cheaply (`--coverage-text`, `vitest run
--coverage`), run it once and keep only the per-directory summary.

## Git archaeology

```bash
# Age and activity profile
git log --reverse --format=%cs | head -1; git log -1 --format=%cs
git log --format=%cs | cut -c1-4 | uniq -c

# Bus factor: recent vs all-time authors
git shortlog -sn --since="12 months ago" | head -10
git shortlog -sn | head -10

# Churn hotspots (exclude lock/vendor/dist noise)
git log --since="2 years ago" --name-only --format= | grep -v -e '\.lock' -e '^vendor/' -e '^node_modules/' -e '^dist/' -e '\.min\.' | sort | uniq -c | sort -rn | head -30

# Recent focus: what the team touched in the last 3 months
git log --since="3 months ago" --name-only --format= | sed 's|/[^/]*$||' | sort | uniq -c | sort -rn | head -15

# Age of a suspicious file (is this dead or stable?)
git log -1 --format='%cs %an' -- path/to/file
```

**The hotspot cross:** intersect the churn top-30 with the biggest-files top-25
and with the absence of a matching test file. Files in all three sets are the
risk-register core and the first candidates for characterization tests.

## Temporal coupling (optional, high signal)

Files that always change together but live in different modules reveal hidden
coupling the architecture map won't show:

```bash
# Co-changed files across recent commits — eyeball pairs that recur
git log --since="1 year ago" --format='---' --name-only | grep -v -e '\.lock' -e '^vendor/' | awk '/^---$/{if (n>1 && n<6) print files; files=""; n=0; next} {files=files" "$0; n++}' | sort | uniq -c | sort -rn | head -15
```

## Environment and config surface

```bash
ls .env* config/ 2>/dev/null
# Config keys referenced but possibly undocumented
grep -rhoE 'env\([A-Z_]+\)|process\.env\.[A-Z_]+|getenv\([^)]*\)' src/ config/ 2>/dev/null | sort -u | head -40
```

Do not print the values of anything that looks like a secret — names only.
