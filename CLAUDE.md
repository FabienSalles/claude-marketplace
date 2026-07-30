# claude-marketplace — project instructions

Narrows the global instructions for this repository only. Everything not contradicted here
still applies.

## English is the language of everything this repository publishes

This is a public open-source repository. **Every artifact that leaves it is in English**,
whatever language the request was written in:

- pull request titles and bodies
- commit messages (already the global rule, restated so nothing reopens it)
- issue titles, bodies and comments
- code comments, documentation, and the text of skills, commands and agents
- anything a plugin prints to whoever runs it

Asking in French does not make the artifact French. The audience of a pull request is whoever
reads the repository, not whoever asked for it.

**What is free to be in either language:** the conversation, and anything under `.claude/`,
which is gitignored and never published — plans, execution logs, run reports. Those are
working notes for one developer, not deliverables.

## The em-dash rule does not apply to English text here

The global instructions forbid `—` mid-phrase because it is an AI tell **in French**. In
English it is ordinary punctuation and this codebase uses it throughout. Keep it out of French
prose; leave it alone in English. Do not "fix" existing English text on that ground.

## Skills and commands are the product

A skill's text is not documentation about the product, it is the product. So the discipline
that applies to code applies to it: no claim that a `grep` would falsify, no instruction that
names a file or a command that does not exist, and a cross-reference is checked before it is
written. A skill that describes a mechanism it does not have costs more than one that describes
nothing, because a reader who finds one contradiction stops trusting the rest.

When a change makes a document false, the document is corrected **in the same commit**. The
history of this repository has three cases of a defect being declared fixed in prose while the
code still carried it, each found later and more expensively.
