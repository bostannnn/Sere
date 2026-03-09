#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PHASE4_UNCOVERED_MATRIX } from "./phase4-uncovered-matrix.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIB_ROOT = path.join(ROOT, "src/lib");

const CONTRACT_SOURCES = [
  {
    owner: "ui-shell-contract",
    file: path.join(ROOT, "dev/check-ui-shell-contract.js"),
  },
  {
    owner: "chat-sidebar-contract",
    file: path.join(ROOT, "dev/check-chat-sidebar-contract.js"),
  },
  {
    owner: "charconfig-rulebook-contract",
    file: path.join(ROOT, "dev/check-charconfig-rulebook-contract.js"),
  },
  {
    owner: "settings-contract",
    file: path.join(ROOT, "dev/check-settings-contract.js"),
  },
  {
    owner: "settings-shell",
    file: path.join(ROOT, "dev/check-settings-shell.js"),
  },
];

const VALID_CLASSIFICATIONS = new Set(["migrate", "infra"]);
const VALID_OWNERS = new Set(CONTRACT_SOURCES.map((source) => source.owner));

/**
 * @typedef SurfaceMatrixEntry
 * @property {string} file
 * @property {"migrate" | "infra"} classification
 * @property {string} owner
 * @property {string} rationale
 * @property {string[]} [requiredPatterns]
 */


function readFile(file) {
  return fs.readFileSync(file, "utf-8");
}

function walkSvelteFiles(startDir) {
  const files = [];
  for (const entry of fs.readdirSync(startDir, { withFileTypes: true })) {
    const fullPath = path.join(startDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkSvelteFiles(fullPath));
      continue;
    }
    if (!entry.name.endsWith(".svelte")) {
      continue;
    }
    files.push(path.relative(ROOT, fullPath).replaceAll(path.sep, "/"));
  }
  return files.sort();
}

function extractSveltePaths(content) {
  return Array.from(content.matchAll(/src\/lib\/[A-Za-z0-9._/-]+\.svelte/g)).map(
    (match) => match[0],
  );
}

const failures = [];

/** @type {Map<string, Set<string>>} */
const coverageByFile = new Map();
for (const source of CONTRACT_SOURCES) {
  const content = readFile(source.file);
  for (const file of extractSveltePaths(content)) {
    if (!coverageByFile.has(file)) {
      coverageByFile.set(file, new Set());
    }
    coverageByFile.get(file).add(source.owner);
  }
}

const allSvelteFiles = walkSvelteFiles(LIB_ROOT);
const preMatrixUncovered = allSvelteFiles.filter((file) => !coverageByFile.has(file));

const seenMatrixFiles = new Set();
for (const entry of PHASE4_UNCOVERED_MATRIX) {
  if (!VALID_OWNERS.has(entry.owner)) {
    failures.push(
      `[phase4-surface-coverage] Invalid owner for ${entry.file}: ${entry.owner}`,
    );
  }
  if (!VALID_CLASSIFICATIONS.has(entry.classification)) {
    failures.push(
      `[phase4-surface-coverage] Invalid classification for ${entry.file}: ${entry.classification}`,
    );
  }
  if (entry.classification === "verify") {
    failures.push(
      `[phase4-surface-coverage] verify classification is no longer allowed: ${entry.file}`,
    );
  }
  if (!entry.rationale || entry.rationale.trim().length === 0) {
    failures.push(`[phase4-surface-coverage] Missing rationale for ${entry.file}`);
  }
  if (entry.classification === "infra" && entry.rationale.trim().length < 12) {
    failures.push(
      `[phase4-surface-coverage] Infra rationale too short for ${entry.file}`,
    );
  }
  if (seenMatrixFiles.has(entry.file)) {
    failures.push(`[phase4-surface-coverage] Duplicate matrix entry: ${entry.file}`);
    continue;
  }
  seenMatrixFiles.add(entry.file);

  const absolute = path.join(ROOT, entry.file);
  if (!fs.existsSync(absolute)) {
    failures.push(`[phase4-surface-coverage] Missing file on disk: ${entry.file}`);
    continue;
  }

  const content = readFile(absolute);
  for (const pattern of entry.requiredPatterns ?? []) {
    if (!content.includes(pattern)) {
      failures.push(
        `[phase4-surface-coverage] Missing required pattern in ${entry.file}: ${pattern}`,
      );
    }
  }

  if (!coverageByFile.has(entry.file)) {
    coverageByFile.set(entry.file, new Set([entry.owner]));
  } else {
    coverageByFile.get(entry.file).add(entry.owner);
  }
}

for (const uncoveredFile of preMatrixUncovered) {
  if (!seenMatrixFiles.has(uncoveredFile)) {
    failures.push(
      `[phase4-surface-coverage] Uncovered surface missing matrix entry: ${uncoveredFile}`,
    );
  }
}

for (const matrixFile of seenMatrixFiles) {
  if (!allSvelteFiles.includes(matrixFile)) {
    failures.push(
      `[phase4-surface-coverage] Matrix entry points to non-lib or missing file: ${matrixFile}`,
    );
  }
}

const finalCovered = new Set(coverageByFile.keys());
const missingCoverage = allSvelteFiles.filter((file) => !finalCovered.has(file));
if (missingCoverage.length > 0) {
  failures.push(
    `[phase4-surface-coverage] Missing coverage for ${missingCoverage.length} surface(s):`,
  );
  for (const file of missingCoverage) {
    failures.push(`  - ${file}`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log(
  `[phase4-surface-coverage] OK (${allSvelteFiles.length} surfaces represented; ${PHASE4_UNCOVERED_MATRIX.length} explicit Phase 4 matrix entries)`,
);
