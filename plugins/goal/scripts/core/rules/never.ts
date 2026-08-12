// The one refusal a plan cannot opt out of, proven in-process as a Result — the message it
// refuses with is carried as a value until gate/never.ts's caller prints and exits on it.

import { err, ok, type Result } from '../result.ts';
import { halt, type Halt } from '../verdict.ts';

// Anchored on a path segment so `src/.env.ts` is left alone while `.env` and `config/.env.local`
// are not. The `.env.example` family is the documented counter-example every project ships, so
// it is excluded by name rather than by hoping nobody writes one.
export const NEVER_VERSIONED = [
  /(^|\/)\.env$/,
  /(^|\/)\.env\.(?!example$|sample$|template$|dist$)/,
  /(^|\/)node_modules\//,
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/,
  /\.(pem|p12|pfx|jks|keystore)$/,
];

export const neverVersionedDecision = (candidates: readonly string[], subject: string): Result<void, Halt> => {
  const refused = [...new Set(candidates)].filter((path) => NEVER_VERSIONED.some((pattern) => pattern.test(path)));

  if (refused.length > 0) {
    return err(halt(
      `${subject} would version a file that must never be committed.`,
      `Refused: ${refused.join(' ')}\n\nThese paths carry credentials or vendored dependencies, so no declaration makes them committable — this check runs before the scope check and ignores what the gate block says. Add them to .gitignore. If one is already committed, treat whatever it holds as disclosed and rotate it: a later deletion does not remove it from history.`,
    ));
  }

  return ok(undefined);
};
