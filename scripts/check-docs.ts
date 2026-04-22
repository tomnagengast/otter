#!/usr/bin/env bun
import { dirname, relative, resolve } from "node:path";
import { Glob } from "bun";

export interface Issue {
  file: string;
  link: string;
  reason: string;
}

export interface CheckResult {
  files: string[];
  issues: Issue[];
}

const PATTERNS = ["docs/**/*.md", "README.md", "packages/*/README.md", "examples/*/README.md"];

export async function checkDocs(cwd: string): Promise<CheckResult> {
  const seen = new Set<string>();
  for (const p of PATTERNS) {
    for await (const f of new Glob(p).scan({ cwd })) {
      seen.add(f);
    }
  }
  const files = Array.from(seen).sort();
  const anchors = new Map<string, Set<string>>();
  const linksByFile = new Map<string, { target: string; line: number }[]>();

  for (const f of files) {
    const text = await Bun.file(resolve(cwd, f)).text();
    anchors.set(f, collectAnchors(text));
    linksByFile.set(f, collectLinks(text));
  }

  const issues: Issue[] = [];
  for (const [file, links] of linksByFile) {
    for (const { target } of links) {
      const [rawPath, anchor] = splitAnchor(target);
      const absDir = dirname(resolve(cwd, file));
      const resolvedPath = rawPath === "" ? file : relative(cwd, resolve(absDir, rawPath));
      const targetAnchors = anchors.get(resolvedPath);

      if (targetAnchors) {
        if (anchor && !targetAnchors.has(anchor)) {
          issues.push({
            file,
            link: target,
            reason: `anchor '#${anchor}' not found in ${resolvedPath}`,
          });
        }
        continue;
      }

      const exists = await Bun.file(resolve(cwd, resolvedPath)).exists();
      if (!exists) {
        issues.push({ file, link: target, reason: "file not found" });
      }
    }
  }

  return { files, issues };
}

export function slug(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function splitAnchor(target: string): [string, string | undefined] {
  const hash = target.indexOf("#");
  if (hash < 0) return [target, undefined];
  return [target.slice(0, hash), target.slice(hash + 1) || undefined];
}

function collectAnchors(text: string): Set<string> {
  const stripped = stripFenced(text);
  const set = new Set<string>();
  for (const m of stripped.matchAll(/^#{1,6}\s+(.+?)\s*$/gm)) {
    const heading = m[1];
    if (!heading) continue;
    set.add(slug(stripInline(heading)));
  }
  return set;
}

function collectLinks(text: string): { target: string; line: number }[] {
  const stripped = stripFenced(text);
  const links: { target: string; line: number }[] = [];
  for (const m of stripped.matchAll(/(?<!!)\[([^\]]+)\]\(([^)]+)\)/g)) {
    const rawTarget = m[2];
    if (!rawTarget) continue;
    const target = rawTarget.trim();
    if (/^https?:\/\//i.test(target)) continue;
    if (/^mailto:/i.test(target)) continue;
    if (target.startsWith("#") && target.length === 1) continue;
    const line = stripped.slice(0, m.index ?? 0).split("\n").length;
    links.push({ target, line });
  }
  return links;
}

function stripFenced(text: string): string {
  return text.replace(/^```[\s\S]*?^```/gm, (m) => m.replace(/[^\n]/g, " "));
}

function stripInline(text: string): string {
  return text.replace(/`([^`]+)`/g, "$1");
}

async function main(): Promise<number> {
  const { files, issues } = await checkDocs(process.cwd());
  if (issues.length > 0) {
    for (const i of issues) console.error(`${i.file}: ${i.link} — ${i.reason}`);
    console.error(`\n${issues.length} issue(s) in ${files.length} file(s).`);
    return 1;
  }
  console.log(`Checked ${files.length} files, 0 broken links.`);
  return 0;
}

if (import.meta.main) {
  process.exit(await main());
}
