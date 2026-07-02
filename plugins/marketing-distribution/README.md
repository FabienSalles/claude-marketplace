# marketing-distribution

Distribution channels — social, threads, email, newsletter.

## Install

```text
/plugin install marketing-distribution@fabien-claude-marketplace
```

## Skills

| Skill | When it triggers | Deep link |
|---|---|---|
| `social-content` | Multi-platform posts (Reddit, Twitter/X, LinkedIn, IG, FB, TikTok). Can post to Reddit via API. | [SKILL.md](skills/social-content/SKILL.md) |
| `thread-writer` | Twitter/X threads + long Reddit posts (templates for story, listicle, tutorial, contrarian) | [SKILL.md](skills/thread-writer/SKILL.md) |
| `email-subject-lines` | Generate/evaluate/A-B-test email subject lines | [SKILL.md](skills/email-subject-lines/SKILL.md) |
| `newsletter` | Newsletter strategy, growth, monetization (Substack/Beehiiv) | [SKILL.md](skills/newsletter/SKILL.md) |

## When to use what

- **social-content vs thread-writer** — single-post multi-platform vs Twitter/X thread depth
- **social-content vs marketing-content:linkedin-content** — multi-platform overview vs LinkedIn-only depth
- **email-subject-lines vs newsletter** — subject line optimization vs full newsletter body + growth strategy

## Requires

- `social-content` and `thread-writer` declare `allowed-tools: [Bash]` for API calls (Reddit, Unsplash).
- Reddit posting requires OAuth env vars — see the reference file in `social-content/references/`.

## Pairs with

- `marketing-content` — produces the content to distribute
- `marketing-analytics` — measures distribution performance
