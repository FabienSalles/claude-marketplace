type Numeric = { kind: 'number'; minimum: number; maximum?: number; default: number };
type Text = { kind: 'text' };

const WEEK = 604800;

const SETTINGS = {
  GOAL_RUN_QUOTA_MAX_RETRIES: { kind: 'number', minimum: 0, default: 3 },
  GOAL_RUN_QUOTA_SLEEP: { kind: 'number', minimum: 0, maximum: WEEK, default: 1800 },
  GOAL_RUN_SHUTDOWN_BACKOFF: { kind: 'number', minimum: 0, maximum: WEEK, default: 5 },
  GOAL_RUN_BURST_CAP: { kind: 'number', minimum: 0, maximum: WEEK, default: 8 },
  GOAL_CMD_TIMEOUT: { kind: 'number', minimum: 1, maximum: WEEK, default: 900 },
  GOAL_PROC_HEADROOM: { kind: 'number', minimum: 1, default: 400 },
  GOAL_RUN_SETTINGS_PATH: { kind: 'text' },
  GOAL_RUN_PROJECTS_ROOT: { kind: 'text' },
  GOAL_GATE: { kind: 'text' },
} as const satisfies Record<string, Numeric | Text>;

export type SettingName = keyof typeof SETTINGS;
export type SettingValue<N extends SettingName> = (typeof SETTINGS)[N] extends Numeric ? number : string | undefined;
export type Env = Readonly<Record<string, string | undefined>>;
export type Effective = { value: number | string | undefined; source: 'environment' | 'default' };

const INTERNAL = ['GOAL_RUN_JSONL', 'GOAL_RUN_TICKED'];
const GUARDED_PREFIXES = ['GOAL_RUN_', 'GOAL_CMD_', 'GOAL_PROC_'];
const RETIRED: Record<string, string> = { GOAL_RUN_SHUTDOWN_MAX_RETRIES: 'GOAL_RUN_QUOTA_MAX_RETRIES' };

const names = Object.keys(SETTINGS) as SettingName[];

const distance = (a: string, b: string): number => {
  let row: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const next: number[] = [i];

    for (let j = 1; j <= b.length; j++) {
      next.push(Math.min((row[j] ?? 0) + 1, (next[j - 1] ?? 0) + 1, (row[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1)));
    }

    row = next;
  }

  return row[b.length] ?? 0;
};

const closest = (name: string): string =>
  names.reduce((best, candidate) => (distance(name, candidate) < distance(name, best) ? candidate : best));

const shape = (setting: Numeric): string =>
  `a whole number of digits from ${setting.minimum} to ${setting.maximum ?? 'any'}, default ${setting.default}`;

const faultOf = (name: SettingName, raw: string): string | undefined => {
  const setting: Numeric | Text = SETTINGS[name];

  if (raw === '') return `${name} is empty: unset the variable to get the default`;
  if (setting.kind === 'text') return undefined;
  if (!/^[0-9]+$/.test(raw)) return `${name}="${raw}" is not a whole number written in digits: expected ${shape(setting)}`;

  const value = Number(raw);

  if (value < setting.minimum || (setting.maximum !== undefined && value > setting.maximum)) {
    return `${name}="${raw}" is out of range: expected ${shape(setting)}`;
  }

  return undefined;
};

const defaultOf = (name: SettingName): number | undefined => {
  const setting: Numeric | Text = SETTINGS[name];

  return setting.kind === 'number' ? setting.default : undefined;
};

export const settingValue = <N extends SettingName>(name: N, env: Env): SettingValue<N> => {
  const raw = env[name];
  const setting: Numeric | Text = SETTINGS[name];

  if (setting.kind === 'text') return raw as SettingValue<N>;

  return (raw === undefined ? setting.default : Number(raw)) as SettingValue<N>;
};

export const checkSettings = (env: Env): { faults: string[]; effective: Record<SettingName, Effective> } => {
  const faults: string[] = [];

  for (const name of Object.keys(env).sort()) {
    if (name in RETIRED) {
      faults.push(`${name} is retired: use ${RETIRED[name]}. Unset it`);
    } else if (!(name in SETTINGS) && !INTERNAL.includes(name) && GUARDED_PREFIXES.some((prefix) => name.startsWith(prefix))) {
      faults.push(`${name} is not a known setting: did you mean ${closest(name)}?`);
    }
  }

  for (const name of names) {
    const raw = env[name];
    const fault = raw === undefined ? undefined : faultOf(name, raw);

    if (fault !== undefined) faults.push(fault);
  }

  const effective = Object.fromEntries(
    names.map((name) => [name, { value: env[name] === undefined ? defaultOf(name) : settingValue(name, env), source: env[name] === undefined ? 'default' : 'environment' }]),
  ) as Record<SettingName, Effective>;

  return { faults, effective };
};
