// The one refusal a plan cannot opt out of: paths that must never enter a commit, whatever
// the gate block says about them.
//
// Every other scope rule asks "was this declared?", so a plan declaring `.env` in impl_files
// answered yes and the gate staged it. That is the wrong question for this class of file: the
// harm is not that nobody expected the change, it is that the file itself has no business in
// git. The secret scanner does not close the gap either — it runs at push, which is after the
// commit, and a secret committed is already in the local history whatever happens next.

import { halt } from './halt.ts';

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

// Reads both what the tree holds and what the plan declared: a plan naming `.env` is refused
// before the file exists, which is the moment it is cheapest to fix.
export const neverVersionedCheck = (candidates: string[], subject: string): void => {
  const refused = [...new Set(candidates)].filter((path) =>
    NEVER_VERSIONED.some((pattern) => pattern.test(path)),
  );

  if (refused.length > 0) {
    halt(
      `${subject} would version a file that must never be committed.`,
      `Refused: ${refused.join(' ')}\n\nThese paths carry credentials or vendored dependencies, so no declaration makes them committable — this check runs before the scope check and ignores what the gate block says. Add them to .gitignore. If one is already committed, treat whatever it holds as disclosed and rotate it: a later deletion does not remove it from history.`,
    );
  }
};
