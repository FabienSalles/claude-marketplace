// The prompt handed to the implementer: the iteration travels as text, verbatim, and the plan's
// path never does.

export const brief = (iteration: string, cwd: string, branch: string, section: string): string => `Implement iteration ${iteration} of a plan somebody else locked.

You are working in ${cwd}, on branch ${branch}. Every path
you read or write lives inside that tree.

The iteration, verbatim from the plan. Its goal, the files to touch, the business rules it
covers, every decision bullet and its gate block.

--- iteration ---
${section}
--- end ---

Work test-first, and show the RED: the gate sets your implementation aside and requires gate1 to
fail without it, so a test that passes either way halts the slice.

Load the project convention skills before writing anything.

You do not commit, do not push, do not stage, do not tick a checkbox and do not edit the plan.
The gate does all of that, after it has verified.`;
