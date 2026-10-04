export type Requirement = 'claude' | 'network';

type Described = {
  readonly name: string;
  readonly group: string;
  readonly requirements: readonly Requirement[];
};

export type CommandCheck = Described & {
  readonly command: readonly string[];
  readonly expectOutput?: RegExp;
};

export type InlineCheck = Described & {
  readonly inline: (root: string) => readonly string[];
};

export type Check = CommandCheck | InlineCheck;

export type Status = 'passed' | 'failed' | 'not-reproduced';

export type Outcome = { readonly status: Status; readonly detail: string };

export type Execute = (check: Check) => Outcome;

export type Write = (text: string) => void;
