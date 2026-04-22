import chalk from "chalk";

export const theme = {
  heading: chalk.hex("#d97706").bold,
  accent: chalk.hex("#d97706"),
  muted: chalk.hex("#6b7280"),
  subtle: chalk.hex("#9ca3af"),
  success: chalk.hex("#16a34a"),
  error: chalk.hex("#dc2626"),
  info: chalk.hex("#0891b2"),
  warn: chalk.hex("#ca8a04"),
  pk: chalk.hex("#a855f7"),
  cursor: chalk.hex("#ec4899"),
  bold: chalk.bold,
  dim: chalk.dim,
  italic: chalk.italic,
} as const;

export const BULLET = theme.muted("•");
export const SEP = theme.muted("·");
export const DASH = theme.muted("—");

export function duration(ms: number): string {
  return theme.dim(`${Math.round(ms)}ms`);
}

export function count(n: number, unit: string): string {
  return `${theme.bold(n.toLocaleString())} ${theme.subtle(unit)}`;
}

export function rel(name: string, schema?: string): string {
  if (!schema) return theme.info(name);
  return `${theme.dim(`${schema}.`)}${theme.info(name)}`;
}

export function status(
  kind: "start" | "done" | "fail" | "skip" | "seed" | "test" | "pass",
  label: string,
  detail?: string,
): string {
  const head = STATUS[kind](STATUS_TEXT[kind]);
  const tail = detail ? ` ${detail}` : "";
  return `${head} ${label}${tail}`;
}

const STATUS_TEXT = {
  start: "build",
  done: "done ",
  fail: "fail ",
  skip: "skip ",
  seed: "seed ",
  test: "test ",
  pass: "pass ",
} as const;

const STATUS = {
  start: theme.accent,
  done: theme.success,
  fail: theme.error,
  skip: theme.muted,
  seed: theme.warn,
  test: theme.info,
  pass: theme.success,
} as const;
