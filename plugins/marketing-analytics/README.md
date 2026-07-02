# marketing-analytics

Marketing analytics — implementation (tracking setup) and reporting (Search Console, GA4).

## Install

```text
/plugin install marketing-analytics@fabien-claude-marketplace
```

## Skills

| Skill | When it triggers | Deep link |
|---|---|---|
| `analytics-tracking` | SET UP tracking: GA4 install, GTM, events, UTMs, conversion setup, tracking plans | [SKILL.md](skills/analytics-tracking/SKILL.md) |
| `google-analytics` | PULL/REPORT GA4 data via the Data API (traffic, acquisition, conversions, audiences) | [SKILL.md](skills/google-analytics/SKILL.md) |
| `search-console` | PULL Search Console data (rankings, clicks, CTR, impressions, index coverage) | [SKILL.md](skills/search-console/SKILL.md) |

## When to use what

- **analytics-tracking vs google-analytics** — set up tracking (implementation) vs read the data (reporting)
- **google-analytics vs search-console** — post-click (site behavior) vs pre-click (search performance)
- **search-console vs marketing-content:seo-audit** — reporting on published search data vs technical/on-page diagnostics on a URL

## Requires

Google Cloud OAuth credentials (client_id, client_secret, refresh_token) for `google-analytics` and `search-console` reporting skills. Both skills document the setup steps inline.

`analytics-tracking` includes progressive-disclosure references under `skills/analytics-tracking/references/`:
- `ga4-implementation.md` — GA4 install patterns
- `gtm-implementation.md` — GTM container setup
- `event-library.md` — reusable event taxonomy

## Pairs with

- `marketing-content:seo-audit` — technical SEO diagnostics complement Search Console reports
- `marketing-strategy` — feeds conversion KPIs back into ICP and positioning
