---
name: product-research
description: ACTIVATE when doing market research, competitive analysis, technology evaluation, or gathering data before BMAD product briefs. ACTIVATE for 'market research', 'competitive analysis', 'vendor evaluation', 'product research', 'gather data', 'tech evaluation'. Provides a 2-phase workflow (gather cheap, synthesize expensive) that feeds into BMAD. DO NOT use for implementation tasks, or a competitive matrix/SWOT against named competitors (see marketing-strategy:competitor-analysis).
version: 1.0.0
---

# Product Research

2-phase workflow for objective research. Designed to feed into BMAD (product briefs, PRDs).

## Philosophy

Research and implementation are separate concerns. Research should be:
- **Objective**: Gather data without confirmation bias
- **Cheap first**: Use web search and documentation before expensive analysis
- **Structured**: Output in a format that feeds directly into BMAD

## Phase 1: Gather (Cheap)

Use web search, documentation, and public data. No Claude analysis yet.

### Steps

1. **Define research questions** (max 5)
   - What do we need to know?
   - What would change our decision?

2. **Gather raw data**
   - Web search for each question
   - Read official documentation
   - Check GitHub repos (stars, issues, last commit, contributors)
   - Find pricing pages, comparison articles, case studies

3. **Save raw findings**
   - Output to `.claude/research/<topic>-raw.md`
   - Include sources with URLs
   - Don't analyze yet — just collect

### Output Template

```markdown
## Research: <topic>
### Questions
1. [question]

### Raw Findings
#### Q1: [question]
- Source: [url] — [key fact]
- Source: [url] — [key fact]

#### Q2: ...
```

## Phase 2: Synthesize (Expensive)

Now analyze the gathered data.

### Steps

1. **Read raw findings** from Phase 1
2. **Analyze per question** — answer each with evidence
3. **Identify gaps** — what couldn't we find? What's uncertain?
4. **Produce recommendation** — with confidence level

### Output Template

```markdown
## Analysis: <topic>

### Answers
#### Q1: [question]
**Answer:** [evidence-based answer]
**Confidence:** High/Medium/Low
**Sources:** [refs]

### Gaps & Uncertainties
- [what we don't know and how it could matter]

### Recommendation
[Clear recommendation with rationale]
```

## Feeding into BMAD

After research is complete:
1. Use findings as input for `/bmad:bmm:workflows:create-product-brief`
2. Reference the research file in the product brief
3. The research data informs: market positioning, feature prioritization, technical feasibility
