---
description: "Objective research — separates investigation from implementation to avoid confirmation bias"
allowed-tools: Agent, Read, Grep, Glob, Bash, WebSearch, WebFetch
---

# Objective Research

You will conduct research on the topic provided as argument: $ARGUMENTS

## Philosophy

Research and implementation are separate concerns. The research agent should NOT know what you plan to build — this prevents confirmation bias.

## Step 1: Frame Research Questions

Based on the topic, formulate 3-5 neutral research questions. These should be:
- Open-ended (not yes/no)
- Factual (answerable with evidence)
- Relevant to making an informed decision

Save questions to `.claude/research/<topic>-questions.md`

## Step 2: Launch Research Agent

Launch an Agent with this prompt:

> You are a research analyst. Your job is to objectively gather information about the following questions. You have NO knowledge of what the user plans to do with this information. Report facts, not recommendations.
>
> Questions: [list from Step 1]
>
> For each question:
> 1. Search the web for current information
> 2. Check official documentation
> 3. Look for benchmarks, case studies, or comparisons
> 4. Note the source and date for each fact
>
> Output raw findings grouped by question. Include contradictory evidence if found. Do NOT make recommendations.

Save agent output to `.claude/research/<topic>-findings.md`

## Step 3: Synthesize

Now YOU (not the agent) analyze the findings:

1. Read the raw findings
2. Answer each question with evidence
3. Identify gaps — what couldn't be found?
4. Assess confidence level per answer (High/Medium/Low)
5. Provide a recommendation ONLY if the user asked for one

## Step 4: Output

Present results:

```markdown
## Research: <topic>

### Q1: [question]
**Answer:** [evidence-based answer]
**Confidence:** High/Medium/Low
**Key sources:** [refs]

### Q2: ...

### Gaps & Uncertainties
- [what we don't know]

### Recommendation (if requested)
[Based on evidence above]

---
Research saved to: .claude/research/<topic>-findings.md
```
