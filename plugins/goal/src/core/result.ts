// The pure socle: a value that carries either a success or a refusal, and the two ways to combine
// one with the rest of a pipeline. Nothing here touches a process, a file, or the clock.

export type Result<T, E = string> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
