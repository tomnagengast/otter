import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { checkDocs, slug } from "./check-docs.ts";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "check-docs-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

async function writeFile(rel: string, content: string): Promise<void> {
  const path = join(dir, rel);
  await Bun.$`mkdir -p ${dirname(path)}`.quiet();
  await Bun.write(path, content);
}

test("slug strips punctuation and lowercases", () => {
  expect(slug("Getting Started")).toBe("getting-started");
  expect(slug("`sql` template")).toBe("sql-template");
  expect(slug("defineConfig()")).toBe("defineconfig");
  expect(slug("events.jsonl")).toBe("eventsjsonl");
});

test("passes on valid cross-links", async () => {
  await writeFile(
    "README.md",
    "# Project\n\nSee [docs](docs/README.md) and [start](docs/getting-started.md#install).\n",
  );
  await writeFile("docs/README.md", "# Docs\n\nSee [start](getting-started.md).\n");
  await writeFile("docs/getting-started.md", "# Start\n\n## Install\n\nSteps.\n");

  const { issues, files } = await checkDocs(dir);
  expect(issues).toEqual([]);
  expect(files.length).toBe(3);
});

test("reports missing file target", async () => {
  await writeFile("README.md", "# Root\n\nSee [missing](docs/missing.md).\n");
  await writeFile("docs/README.md", "# Docs\n");

  const { issues } = await checkDocs(dir);
  expect(issues.length).toBe(1);
  const [issue] = issues;
  expect(issue).toBeDefined();
  if (!issue) throw new Error("expected a missing file issue");
  expect(issue.link).toBe("docs/missing.md");
  expect(issue.reason).toBe("file not found");
});

test("reports missing anchor target", async () => {
  await writeFile("docs/README.md", "# Docs\n\nSee [install](getting-started.md#install-v2).\n");
  await writeFile("docs/getting-started.md", "# Start\n\n## Install\n");

  const { issues } = await checkDocs(dir);
  expect(issues.length).toBe(1);
  const [issue] = issues;
  expect(issue).toBeDefined();
  if (!issue) throw new Error("expected a missing anchor issue");
  expect(issue.reason).toContain("anchor '#install-v2' not found");
});

test("ignores http/https/mailto links", async () => {
  await writeFile("README.md", "# Root\n\n[web](https://example.com) [mail](mailto:x@y.z)\n");
  const { issues } = await checkDocs(dir);
  expect(issues).toEqual([]);
});

test("ignores links inside fenced code blocks", async () => {
  await writeFile(
    "README.md",
    "# Root\n\n```md\n[dead](missing.md)\n```\n\n[ok](docs/README.md)\n",
  );
  await writeFile("docs/README.md", "# Docs\n");
  const { issues } = await checkDocs(dir);
  expect(issues).toEqual([]);
});

test("accepts anchors matching headings with inline code", async () => {
  await writeFile("docs/README.md", "# Docs\n\nSee [sql](models.md#sql-template).\n");
  await writeFile("docs/models.md", "# Models\n\n## `sql` template\n\nBody.\n");

  const { issues } = await checkDocs(dir);
  expect(issues).toEqual([]);
});
