// Shared shell quoting: every runner module that shells out needs the same quoting, so the one
// definition lives here rather than four copies drifting apart.

export const quote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`;
