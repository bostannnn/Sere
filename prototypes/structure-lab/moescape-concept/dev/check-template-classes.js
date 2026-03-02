#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const conceptRoot = path.resolve(scriptDir, '..');
const inputFiles = ['index.html', 'app.js'].map((name) => path.join(conceptRoot, name));
const stylesPath = path.join(conceptRoot, 'styles.css');

function lineForIndex(content, index) {
  return content.slice(0, index).split('\n').length;
}

function extractClassUsages(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const sanitizedContent = content.replace(/\$\{[\s\S]*?\}/g, (expression) =>
    expression.replace(/[^\n]/g, ' '),
  );
  const rel = path.relative(conceptRoot, filePath);
  const classAttrRegex = /class\s*=\s*["'`]([^"'`]*)["'`]/g;
  const usages = [];
  let match;

  while ((match = classAttrRegex.exec(sanitizedContent)) !== null) {
    const classValue = match[1];
    const line = lineForIndex(sanitizedContent, match.index);
    for (const token of classValue.split(/\s+/)) {
      if (!token) continue;
      if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(token)) continue;
      usages.push({ className: token, file: rel, line });
    }
  }
  return usages;
}

function extractDefinedClasses(cssPath) {
  const css = fs.readFileSync(cssPath, 'utf8');
  const classRegex = /\.([A-Za-z_][A-Za-z0-9_-]*)/g;
  const classes = new Set();
  let match;
  while ((match = classRegex.exec(css)) !== null) {
    classes.add(match[1]);
  }
  return classes;
}

const usageMap = new Map();
for (const filePath of inputFiles) {
  for (const usage of extractClassUsages(filePath)) {
    if (!usageMap.has(usage.className)) usageMap.set(usage.className, []);
    usageMap.get(usage.className).push({ file: usage.file, line: usage.line });
  }
}

const defined = extractDefinedClasses(stylesPath);
const missing = [...usageMap.keys()].filter((className) => !defined.has(className)).sort();

if (missing.length > 0) {
  console.error('FAIL check-template-classes: class names used in templates but not defined in styles.css');
  for (const className of missing) {
    const spots = usageMap.get(className) ?? [];
    const preview = spots
      .slice(0, 3)
      .map((spot) => `${spot.file}:${spot.line}`)
      .join(', ');
    const more = spots.length > 3 ? ` (+${spots.length - 3} more)` : '';
    console.error(`  - .${className}: ${preview}${more}`);
  }
  process.exit(1);
}

console.log(
  `PASS check-template-classes: ${usageMap.size} class names used across templates, all defined in styles.css`,
);
