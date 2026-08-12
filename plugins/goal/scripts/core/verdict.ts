// The pure shape of a refusal a core function can hand back: a reason and a detail, exactly
// what gate/halt.ts prints and exits on — but carried as a value until an adapter does that.
// Nothing here touches stdout or the process.

export type Halt = { readonly reason: string; readonly detail: string };

export const halt = (reason: string, detail: string): Halt => ({ reason, detail });

// The four outcomes goal-run.ts's own exit codes name, read from one place instead of redefined
// in run/iteration.ts and run/close.ts, where they used to disagree only by being two separate
// declarations of the same numbers.
export const LANDED = 0;
export const HALTED = 1;
export const REFUSED = 2;
export const PAUSED = 3;
