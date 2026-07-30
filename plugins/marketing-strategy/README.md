# marketing-strategy

Strategic marketing playbooks — audience, positioning, campaign ideation, competitive intelligence.

## Install

```text
/plugin install marketing-strategy@fabien-claude-marketplace
```

## Skills

| Skill | When it triggers | Deep link |
|---|---|---|
| `icp-builder` | Define Ideal Customer Profile + buyer personas (B2B/B2C) | [SKILL.md](skills/icp-builder/SKILL.md) |
| `product-marketing` | Positioning (April Dunford), messaging, GTM, battlecards | [SKILL.md](skills/product-marketing/SKILL.md) |
| `product-marketing-context` | Maintain shared `.claude/product-marketing-context.md`, read by `product-marketing`, `marketing-psychology`, and `marketing-analytics:analytics-tracking` | [SKILL.md](skills/product-marketing-context/SKILL.md) |
| `marketing-psychology` | Apply 70+ cognitive biases and mental models to marketing | [SKILL.md](skills/marketing-psychology/SKILL.md) |
| `marketing-ideas` | 139 proven marketing ideas by category, with implementation guidance | [SKILL.md](skills/marketing-ideas/SKILL.md) |
| `competitor-analysis` | Full competitor breakdown (SEO, ads, social, pricing, positioning) | [SKILL.md](skills/competitor-analysis/SKILL.md) |

## When to use what

Near-neighbor disambiguation:

- **product-marketing vs product-marketing-context** — do strategy work vs maintain a shared context file. Set up context ONCE so other skills stop re-asking foundational questions.
- **marketing-ideas vs competitor-analysis** — brainstorm new tactics vs learn what competitors are already doing
- **icp-builder vs product-marketing** — who buys vs how to position

## Recommended workflow

1. `icp-builder` → define who you serve
2. `competitor-analysis` → understand the landscape
3. `product-marketing` → craft positioning + messaging
4. `product-marketing-context` → save the answers into `.claude/product-marketing-context.md`
5. Now `product-marketing`, `marketing-psychology`, and `marketing-analytics:analytics-tracking` auto-read that context.

## Pairs with

- `marketing-content` — turns strategy into content
- `marketing-distribution` — channels for the strategy
