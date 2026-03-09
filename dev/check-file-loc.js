#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const args = new Set(process.argv.slice(2));
const maxArg = process.argv.find((arg) => arg.startsWith("--max="));
const maxLines = maxArg ? Number(maxArg.split("=")[1]) : 500;
const stagedOnly = args.has("--staged");
const failOnViolation = args.has("--fail-on-violation");
const codeExtensions = new Set([
  ".js",
  ".cjs",
  ".mjs",
  ".ts",
  ".cts",
  ".mts",
  ".jsx",
  ".tsx",
  ".svelte",
]);
const codeDirPrefixes = ["src/", "server/", "dev/", "scripts/", "prototypes/"];

if (!Number.isFinite(maxLines) || maxLines <= 0) {
  console.error("[loc-check] --max must be a positive number.");
  process.exit(1);
}

function runGit(argsList) {
  try {
    const out = execFileSync("git", argsList, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return out.trim();
  } catch (error) {
    const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr || "").trim() : "";
    console.error("[loc-check] Failed to run git command:", argsList.join(" "));
    if (stderr) {
      console.error(stderr);
    }
    process.exit(1);
  }
}

function listCandidateFiles() {
  if (stagedOnly) {
    const out = runGit(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]);
    if (!out) return [];
    return out.split("\n");
  }

  const out = runGit(["ls-files"]);
  if (!out) return [];
  return out.split("\n");
}

function listStagedEntries() {
  if (!stagedOnly) {
    return [];
  }

  const out = runGit(["diff", "--cached", "--name-status", "--diff-filter=ACMR"]);
  if (!out) {
    return [];
  }

  return out
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("\t");
      const status = parts[0] ?? "";

      if (status.startsWith("R") || status.startsWith("C")) {
        return {
          status: status.startsWith("R") ? "R" : "C",
          oldPath: parts[1] ?? "",
          relPath: parts[2] ?? "",
        };
      }

      return {
        status,
        oldPath: null,
        relPath: parts[1] ?? "",
      };
    })
    .filter((entry) => entry.relPath);
}

function isCodeFile(relPath) {
  const normalized = relPath.replaceAll("\\", "/");
  const ext = path.extname(normalized).toLowerCase();
  if (!codeExtensions.has(ext)) {
    return false;
  }

  if (codeDirPrefixes.some((prefix) => normalized.startsWith(prefix))) {
    return true;
  }

  // Allow root-level JS/TS config and utility files.
  return !normalized.includes("/");
}

function isLikelyBinary(buffer) {
  return buffer.includes(0);
}

function countLines(buffer) {
  if (buffer.length === 0) return 0;
  const content = buffer.toString("utf8");
  return content.split(/\r?\n/).length;
}

function readTrackedFileBuffer(refPath) {
  try {
    return execFileSync("git", ["show", `HEAD:${refPath}`], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return null;
  }
}

function readStagedFileBuffer(relPath) {
  try {
    return execFileSync("git", ["show", `:${relPath}`], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return null;
  }
}

function getPreviousLineCount(relPath, oldPath = null) {
  const refPath = oldPath || relPath;
  if (!refPath) {
    return null;
  }

  const buffer = readTrackedFileBuffer(refPath);
  if (!buffer || isLikelyBinary(buffer)) {
    return null;
  }

  return countLines(buffer);
}

const candidates = listCandidateFiles();
const stagedEntries = new Map(
  listStagedEntries().map((entry) => [entry.relPath, entry])
);
const violations = [];

for (const relPath of candidates) {
  if (!isCodeFile(relPath)) {
    continue;
  }

  const buffer = stagedOnly
    ? readStagedFileBuffer(relPath)
    : (() => {
        const absPath = path.join(ROOT, relPath);
        if (!fs.existsSync(absPath)) {
          return null;
        }
        const stat = fs.statSync(absPath);
        if (!stat.isFile()) {
          return null;
        }
        return fs.readFileSync(absPath);
      })();

  if (!buffer) {
    continue;
  }

  if (isLikelyBinary(buffer)) {
    continue;
  }

  const lines = countLines(buffer);
  if (!stagedOnly) {
    if (lines > maxLines) {
      violations.push({ relPath, lines });
    }
    continue;
  }

  const stagedEntry = stagedEntries.get(relPath) ?? {
    status: "M",
    oldPath: null,
    relPath,
  };
  const previousLines = getPreviousLineCount(relPath, stagedEntry.oldPath);
  const isNewFile = stagedEntry.status === "A" || stagedEntry.status === "C" || previousLines === null;
  const crossedLimit = previousLines !== null && previousLines <= maxLines && lines > maxLines;
  const grewWhileOversized = previousLines !== null && previousLines > maxLines && lines > previousLines;

  if (isNewFile && lines > maxLines) {
    violations.push({
      relPath,
      lines,
      previousLines,
      reason: `new file exceeds ${maxLines} LOC`,
    });
    continue;
  }

  if (crossedLimit) {
    violations.push({
      relPath,
      lines,
      previousLines,
      reason: `crossed from ${previousLines} to ${lines} LOC`,
    });
    continue;
  }

  if (grewWhileOversized) {
    violations.push({
      relPath,
      lines,
      previousLines,
      reason: `grew from ${previousLines} to ${lines} LOC while already over ${maxLines}`,
    });
  }
}

if (violations.length === 0) {
  if (stagedOnly) {
    console.log(
      `[loc-check] OK: no staged files created or grew past the ${maxLines} LOC ratchet.`
    );
  } else {
    console.log(`[loc-check] OK: no tracked files exceed ${maxLines} LOC.`);
  }
  process.exit(0);
}

violations.sort((a, b) => b.lines - a.lines || a.relPath.localeCompare(b.relPath));

if (!stagedOnly) {
  console.warn(`[loc-check] WARNING: ${violations.length} file(s) exceed ${maxLines} LOC:`);
  for (const item of violations) {
    console.warn(`  - ${item.relPath}: ${item.lines} LOC`);
  }

  if (failOnViolation) {
    process.exit(1);
  }

  console.warn("[loc-check] Commit is allowed (warning-only mode).");
  process.exit(0);
}

console.warn(
  `[loc-check] RATCHET violation: ${violations.length} staged file(s) created or grew beyond ${maxLines} LOC:`
);
for (const item of violations) {
  if (item.previousLines === null) {
    console.warn(`  - ${item.relPath}: ${item.lines} LOC (${item.reason})`);
  } else {
    console.warn(
      `  - ${item.relPath}: ${item.previousLines} -> ${item.lines} LOC (${item.reason})`
    );
  }
}

if (failOnViolation) {
  process.exit(1);
}

console.warn("[loc-check] Staged changes are allowed (warning-only mode).");
