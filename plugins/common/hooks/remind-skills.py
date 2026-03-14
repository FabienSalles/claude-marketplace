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
    return """**RAPPEL SKILLS - Fichier PHP**

Avant de modifier ce fichier PHP, as-tu consulté les skills appropriés ?

**Skills de code :**
| Niveau | Skill | Contenu |
|--------|-------|---------|
| **User** | `~/.claude/skills/code-conventions/` | PER Coding Style, PSR-12 |
| **User** | `~/.claude/skills/sql-conventions/` | Conventions SQL (queries, heredocs) |
| **Organization** | `projects/org/.claude/skills/code-conventions/` | Organization conventions |
| **Projet** | `.claude/skills/code-conventions/` | Conventions projet |

Points critiques :
- **PER Coding Style** : heredocs indentés +1 niveau, espacement autour des structures de contrôle
- **SQL** : Commencer par l'entité connue, heredoc Format 2 (paramètre séparé)
- **PSR-12** : Standards de formatage PHP"""


def get_test_reminder():
    return """**RAPPEL SKILLS - Fichier de Test PHP**

Avant de modifier ce test, as-tu consulté les skills appropriés ?

**Skills de test :**
| Niveau | Skill | Contenu |
|--------|-------|---------|
| **User** | `~/.claude/skills/test-conventions/` | DAMP, test doubles, AAA |
| **User** | `~/.claude/skills/tdd-workflow/` | Red-Green-Refactor |
| **Projet** | `.claude/skills/test-conventions/` | Conventions projet |

**Skills de code (s'appliquent aussi) :**
| Niveau | Skill |
|--------|-------|
| **User** | `~/.claude/skills/code-conventions/` |
| **Organization** | `projects/org/.claude/skills/code-conventions/` |
| **Projet** | `.claude/skills/code-conventions/` |

Points critiques :
- **PER Coding Style** : heredocs indentés +1 niveau
- **DAMP** : Clarté sur DRY dans les tests
- **AAA** : Arrange-Act-Assert sans commentaires"""


def get_twig_reminder():
    return """**RAPPEL SKILLS - Template Twig**

Avant de modifier ce template, as-tu consulté les skills Twig ?

| Niveau | Skill | Contenu |
|--------|-------|---------|
| **User** | `~/.claude/skills/twig-conventions/` | Translations, composants |
| **User** | `~/.claude/skills/theme-bundle-conventions/` | Si projet utilise `acme/ui-bundle` |

Points critiques :
- **Translations** : Composants `<twig:*>` n'héritent PAS de `trans_default_domain`
- **Breadcrumbs** : Utiliser `params:` et non `parameters:`
- **Icons** : Ajouter dans theme-bundle, pas dans le projet"""


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
