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
    return """**SKILLS REMINDER - PHP file**

Before editing this PHP file, did you consult the relevant skills?

**Code skills:**
| Level | Skill | Content |
|-------|-------|---------|
| **User** | `~/.claude/skills/code-conventions/` | PER Coding Style, PSR-12 |
| **User** | `~/.claude/skills/sql-conventions/` | SQL conventions (queries, heredocs) |
| **Organization** | `projects/org/.claude/skills/code-conventions/` | Organization conventions |
| **Project** | `.claude/skills/code-conventions/` | Project conventions |

Critical points:
- **PER Coding Style**: heredocs indented +1 level, spacing around control structures
- **SQL**: start from the known entity, heredoc Format 2 (separate parameter)
- **PSR-12**: PHP formatting standards"""


def get_test_reminder():
    return """**SKILLS REMINDER - PHP test file**

Before editing this test, did you consult the relevant skills?

**Test skills:**
| Level | Skill | Content |
|-------|-------|---------|
| **User** | `~/.claude/skills/test-conventions/` | DAMP, test doubles, AAA |
| **User** | `~/.claude/skills/tdd-workflow/` | Red-Green-Refactor |
| **Project** | `.claude/skills/test-conventions/` | Project conventions |

**Code skills (also apply):**
| Level | Skill |
|-------|-------|
| **User** | `~/.claude/skills/code-conventions/` |
| **Organization** | `projects/org/.claude/skills/code-conventions/` |
| **Project** | `.claude/skills/code-conventions/` |

Critical points:
- **PER Coding Style**: heredocs indented +1 level
- **DAMP**: clarity over DRY in tests
- **AAA**: Arrange-Act-Assert without comments"""


def get_twig_reminder():
    return """**SKILLS REMINDER - Twig template**

Before editing this template, did you consult the Twig skills?

| Level | Skill | Content |
|-------|-------|---------|
| **User** | `~/.claude/skills/twig-conventions/` | Translations, components |
| **User** | `~/.claude/skills/theme-bundle-conventions/` | If the project uses `acme/ui-bundle` |

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
