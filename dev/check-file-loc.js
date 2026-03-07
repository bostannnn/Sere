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

const candidates = listCandidateFiles();
const violations = [];

for (const relPath of candidates) {
  if (!isCodeFile(relPath)) {
    continue;
  }

  const absPath = path.join(ROOT, relPath);
  if (!fs.existsSync(absPath)) {
    continue;
  }
  const stat = fs.statSync(absPath);
  if (!stat.isFile()) {
    continue;
  }

  const buffer = fs.readFileSync(absPath);
  if (isLikelyBinary(buffer)) {
    continue;
  }

  const lines = countLines(buffer);
  if (lines > maxLines) {
    violations.push({ relPath, lines });
  }
}

if (violations.length === 0) {
  const scope = stagedOnly ? "staged files" : "tracked files";
  console.log(`[loc-check] OK: no ${scope} exceed ${maxLines} LOC.`);
  process.exit(0);
}

violations.sort((a, b) => b.lines - a.lines || a.relPath.localeCompare(b.relPath));

console.warn(`[loc-check] WARNING: ${violations.length} file(s) exceed ${maxLines} LOC:`);
for (const item of violations) {
  console.warn(`  - ${item.relPath}: ${item.lines} LOC`);
}

if (failOnViolation) {
  process.exit(1);
}

console.warn("[loc-check] Commit is allowed (warning-only mode).");
