#!/usr/bin/env python3
"""
PreToolUse hook that reminds Claude to read relevant skills when editing files.

Skills hierarchy:
- User level: ~/.claude/skills/
- Organization level: ~/projects/org/.claude/skills/
- Project level: .claude/skills/

File type -> Skills mapping:
- *.php (not Test) -> code-conventions + sql-conventions (user + org + project)
- *Test.php -> test-conventions + code-conventions + tdd-workflow
- *.twig -> twig-conventions + theme-bundle-conventions (if using theme-bundle)
"""
import json
import sys


def get_php_reminder():
    return """**SKILLS - PHP file: LOAD, don't just recall**

If not already loaded IN THIS SESSION, load NOW via the Skill tool, before this edit.
An invoked skill whose content never appeared in context is a FAILED load - re-invoke it.

| Skill | What it settles |
|-------|-----------------|
| `php:php-code-conventions` | code style beyond linters (no empty(), nullsafe, ordering) |
| `php:php-sql-conventions` | only if the file writes SQL/DBAL |
| `php:php-8-2` / `php:php-8-3` | readonly class, typed constants + visibility |
| project skills (`.claude/skills/`) | e.g. eres-php-conventions (final, no autowire, foreach over array_*) |

A convention is a rule, not a statistic: never arbitrate by counting existing usages."""


def get_test_reminder():
    return """**SKILLS - PHP test file: LOAD, don't just recall**

If not already loaded IN THIS SESSION, load NOW via the Skill tool, before this edit.
An invoked skill whose content never appeared in context is a FAILED load - re-invoke it.

| Skill | What it settles |
|-------|-----------------|
| `craft:testing-principles` | level choice (intent reads best, deciding class = last resort), what NOT to test, naming, no test-only classes |
| `phpunit:php-test-conventions` | Prophecy is the rule (never createMock), providers over enums, doubles, factories |
| `symfony:symfony-test-conventions` | only if the test boots Symfony: WebTestCase / TypeTestCase / KernelTestCase, crawler, container doubles |
| project skills (`.claude/skills/`) | e.g. eres-php-conventions |

Hard points:
- A business rule is tested where its INTENT reads best; the deciding class is the last resort
- Never a production-shaped class living only for tests; the fixture is the real concrete class
- Identifiers reuse the codebase's exact vocabulary (Subscriber, source...) - no synonyms
- A convention is a rule, not a statistic: never arbitrate by counting existing usages"""


def get_twig_reminder():
    return """**SKILLS - Twig template: LOAD, don't just recall**

If not already loaded IN THIS SESSION, load NOW via the Skill tool, before this edit.

| Skill | What it settles |
|-------|-----------------|
| `symfony:twig-conventions` | trans_default_domain isolation, when to create a component |
| project theme skill (`.claude/skills/`) | e.g. eres-theme-bundle (breadcrumb `params:`, icons, SCSS vars) |

Critical points:
- **Translations**: `<twig:*>` components do NOT inherit `trans_default_domain`
- **Breadcrumbs**: use `params:`, not `parameters:`
- **Icons**: add them in theme-bundle, not in the project"""


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)

    tool_name = input_data.get('tool_name', '')
    file_path = input_data.get('tool_input', {}).get('file_path', '')

    if tool_name not in ['Write', 'Edit']:
        sys.exit(0)

    reminder = None

    if file_path.endswith('Test.php'):
        reminder = get_test_reminder()
    elif file_path.endswith('.php'):
        reminder = get_php_reminder()
    elif file_path.endswith('.twig'):
        reminder = get_twig_reminder()

    if reminder:
        output = {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "additionalContext": reminder
            }
        }
        print(json.dumps(output))

    sys.exit(0)


if __name__ == '__main__':
    main()
