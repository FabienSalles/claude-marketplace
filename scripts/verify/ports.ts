export type Requirement = 'claude' | 'network' | 'node24' | 'uv';

type Described = {
  readonly name: string;
  readonly group: string;
  readonly requirements: readonly Requirement[];
  readonly exclusive?: boolean;
  readonly timeoutSeconds?: number;
};

export type CommandCheck = Described & {
  readonly command: readonly string[];
  readonly expectOutput?: RegExp;
  readonly refuseOutput?: RegExp;
  readonly runs?: readonly string[];
};

export type InlineCheck = Described & {
  readonly inline: (root: string) => readonly string[];
};

export type Check = CommandCheck | InlineCheck;

export type Status = 'passed' | 'failed' | 'not-reproduced';

export type Outcome = { readonly status: Status; readonly detail: string };

export type Execute = (check: Check, abort: AbortSignal) => Promise<Outcome>;

export type Write = (text: string) => void;

export type Probe = (requirement: Requirement) => string | undefined;
