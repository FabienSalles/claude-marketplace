// The pure shape of a refusal a core function can hand back: a reason and a detail, exactly
// what gate/halt.ts prints and exits on — but carried as a value until an adapter does that.
// Nothing here touches stdout or the process.

export type Halt = { readonly reason: string; readonly detail: string };

export const halt = (reason: string, detail: string): Halt => ({ reason, detail });
