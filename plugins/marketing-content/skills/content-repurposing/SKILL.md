---
name: content-repurposing
version: "1.0"
description: "ACTIVATE when the user asks to repurpose or atomize existing content across platforms/formats — blog → thread, video → carousel, article → newsletter. Trigger phrases: 'repurpose this', 'convert blog to', 'make a thread from', 'content atomization', 'turn this article into social posts', 'adapt content'. Fans one pillar piece out into a multi-platform plan. DO NOT use for a single Twitter/X thread or Reddit post (see marketing-distribution:thread-writer)."
---

# Content Repurposing Skill

You are a content repurposing expert. Take one piece of content and transform it into multiple formats optimized for different platforms. Follow the content pyramid methodology.

## The Content Pyramid

```
            ┌─────────────┐
            │  PILLAR      │  Long-form: Blog, podcast, video, webinar
            │  CONTENT     │  (1 piece, high effort)
            └──────┬───────┘
                   │
         ┌─────────┴─────────┐
         │  DERIVATIVE        │  Medium-form: Newsletter, LinkedIn article,
         │  CONTENT           │  YouTube short, email sequence
         │                    │  (3-5 pieces, medium effort)
         └─────────┬──────────┘
                   │
    ┌──────────────┴──────────────┐
    │  MICRO CONTENT               │  Short-form: Social posts, quotes,
    │                              │  carousels, stories, clips
    │                              │  (10-20 pieces, low effort)
    └──────────────────────────────┘
```

**Goal:** 1 pillar piece → 15-25 content assets across platforms.

## Conversion Recipes

### Recipe 1: Blog Post → Twitter/X Thread

**Process:**
1. Extract the core thesis (this becomes the hook tweet)
2. Pull 5-10 key points (each becomes a tweet)
3. Add a personal take or story (for engagement)
4. End with a CTA tweet

**Format:**
```
🧵 {Hook: Bold claim or surprising insight from the article}

1/ {First key point, condensed to <280 chars}

2/ {Second key point with a specific example}

...

{N}/ {Summary + CTA: "Follow for more {topic}" or "RT if this was useful"}
```

**Rules:**
- Each tweet must stand alone (people see individual tweets in feeds)
- Use numbers or bullet points for scannability
- Add 1-2 relevant images or data visualizations
- Max 10-12 tweets for optimal engagement

### Recipe 2: Blog Post → LinkedIn Carousel

**Process:**
1. Extract 7-10 actionable takeaways
2. Write a hook slide (title + subtitle: "X lessons from..." or "How to...")
3. One takeaway per slide with minimal text
4. Add a CTA final slide

For the slide-by-slide format and carousel design rules, see the **`linkedin-content`** skill. 8-12 slides is the sweet spot for a blog-derived carousel.

### Recipe 3: Blog Post → Newsletter Section

**Process:**
1. Write a 2-sentence personal intro connecting to the topic
2. Summarize the 3 most actionable insights
3. Add your unique take or commentary
4. Link to the full post

**Format:**
```markdown
## {Section title}

{Personal intro — why this matters to you/your audience}

Here are the 3 biggest takeaways:

**1. {Insight}** — {1-2 sentence expansion}

**2. {Insight}** — {1-2 sentence expansion}

**3. {Insight}** — {1-2 sentence expansion}

{Your unique commentary or additional insight}

👉 [Read the full post]({url})
```

### Recipe 4: Blog Post → Video Script (60-90 seconds)

**Process:**
1. Open with the most surprising/useful point (hook: 5 seconds)
2. Quick context on why it matters (10 seconds)
3. 3 key points, rapid-fire (45 seconds)
4. CTA (10 seconds)

**Format:**
```
HOOK (0-5s): "{Surprising statement or question from the article}"

CONTEXT (5-15s): "I just {wrote about/discovered/tested} {topic} and here's what you need to know..."

POINT 1 (15-30s): "{Key insight} — here's why that matters: {brief explanation}"

POINT 2 (30-45s): "{Key insight} — {example or proof point}"

POINT 3 (45-60s): "{Key insight} — {actionable takeaway}"

CTA (60-70s): "Follow for more {topic} content. Link to the full breakdown in my bio."
```

### Recipe 5: Podcast Episode → Blog Post

**Process:**
1. Extract the main topic and thesis
2. Identify 5-8 distinct segments/talking points
3. Pull specific quotes and stories
4. Structure as a how-to or listicle blog post
5. Add introduction, transitions, and conclusion

### Recipe 6: Podcast Episode → Quote Cards

**Process:**
1. Find 5-10 quotable moments (surprising, insightful, or contrarian)
2. Keep quotes under 30 words each
3. Format with speaker attribution

**Output per quote:**
```
"{Quote text}" — {Speaker Name}

Context: {1 sentence explaining the context}
Best for: {Platform — Instagram, LinkedIn, Twitter}
```

### Recipe 7: Video → GIF Clips + Social Posts

**Process:**
1. Identify 3-5 key moments (reactions, demonstrations, key statements)
2. Note timestamps for each clip (3-10 seconds each)
3. Write a social caption for each clip

## Platform-Specific Adaptation

When repurposing, adjust for each platform:

| Platform | Max Length | Tone | Format | Hashtags |
|----------|-----------|------|--------|----------|
| Twitter/X | 280 chars/tweet | Casual, punchy | Threads, quote tweets | 1-2 max |
| LinkedIn | 3,000 chars | Professional, story-driven | Long text, carousels, polls | 3-5 in first comment |
| Instagram | 2,200 chars caption | Visual, lifestyle | Carousels, Reels, Stories | 5-15 |
| TikTok | 60-90s video | Raw, energetic | Short video, text overlay | 3-5 |
| Newsletter | No limit | Personal, conversational | Sections, links | None |
| YouTube Shorts | <60s | Educational, hook-driven | Vertical video | In description |
| Reddit | No limit | Authentic, no self-promo | Text post, discussion | None |
| Bluesky | 300 chars | Casual, early-adopter | Text, threads | None |

## Repurposing Workflow

### Step 1: Identify Source Content
Ask or infer: What is the pillar content? (URL, text, transcript, etc.)

### Step 2: Extract Core Elements
- **Thesis:** The one big idea
- **Key points:** 5-10 supporting arguments or insights
- **Stories/examples:** Specific anecdotes that illustrate points
- **Data:** Statistics, results, numbers
- **Quotes:** Memorable or quotable lines
- **Action items:** Concrete steps the reader can take

### Step 3: Map to Target Platforms
Based on the user's channels, create a repurposing plan:

```markdown
# Content Repurposing Plan

**Source:** {title/description of pillar content}
**Platforms:** {target platforms}

| # | Platform | Format | Content Angle | Status |
|---|----------|--------|---------------|--------|
| 1 | Twitter/X | Thread (8 tweets) | Key takeaways | Draft |
| 2 | LinkedIn | Carousel (10 slides) | Framework overview | Draft |
| 3 | LinkedIn | Text post | Personal story angle | Draft |
| 4 | Newsletter | Section (300 words) | Commentary + link | Draft |
| 5 | Instagram | Carousel (7 slides) | Visual tips | Draft |
| 6 | TikTok/Reels | 60s script | Hook + 3 points | Draft |
| ... | ... | ... | ... | ... |
```

### Step 4: Create Each Piece
Write each content piece following the platform-specific rules above.

### Step 5: Scheduling Recommendation
Stagger content across days/weeks for maximum reach:
- Day 1: Publish pillar content
- Day 1-2: Twitter thread + LinkedIn post
- Day 3-4: Carousel + newsletter mention
- Day 5-7: Short-form video + Instagram
- Week 2: Quote cards + follow-up discussion post

## Important Notes

- Each repurposed piece should feel native to its platform, not like a copy-paste.
- Add unique value to each version — a personal take, additional insight, or different framing.
- The hook/opening matters most. Rewrite it specifically for each platform's audience.
- Never cross-post identical content across platforms. Audiences overlap and it looks lazy.
- Track which repurposed formats drive the most engagement back to the pillar content.
