/**
 * Enhanced PDF extractor with column awareness and basic filtering for Node.js.
 */
const COLUMN_BREAK_MARKER = '__RISU_COLUMN_BREAK__';

function normalizeLineText(text) {
    if (typeof text !== 'string') return '';
    return text
        .replace(/\0/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function isColumnBreakMarker(text) {
    return normalizeLineText(text) === COLUMN_BREAK_MARKER;
}

function normalizeTableRowText(cells) {
    const normalizedCells = Array.isArray(cells)
        ? cells.map((cell) => normalizeLineText(cell)).filter(Boolean)
        : [];
    return normalizedCells.join(' ; ');
}

function canonicalizeForDedupe(text) {
    if (typeof text !== 'string') return '';
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function countLetters(text) {
    if (typeof text !== 'string') return 0;
    try {
        return (text.match(/\p{L}/gu) || []).length;
    } catch {
        return (text.match(/[A-Za-z]/g) || []).length;
    }
}

function countLettersAndDigits(text) {
    if (typeof text !== 'string') return 0;
    try {
        return (text.match(/[\p{L}\p{N}]/gu) || []).length;
    } catch {
        return (text.match(/[A-Za-z0-9]/g) || []).length;
    }
}

function looksLikeListItem(text) {
    const line = normalizeLineText(text);
    if (!line) return false;
    return /^[-*+]\s+/.test(line) || /^\d+[\.\)]\s+/.test(line);
}

function looksLikeHeadingLine(text) {
    const line = normalizeLineText(text);
    if (!line) return false;
    if (line.length > 90) return false;
    if (/[.!?]$/.test(line)) return false;
    if (looksLikeListItem(line)) return false;
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.length > 10) return false;
    return /^[A-Z0-9]/.test(line);
}

function looksMostlyUppercase(text) {
    const line = normalizeLineText(text);
    const letters = countLetters(line);
    if (letters < 5) return false;
    const uppercaseLetters = (line.match(/[A-Z]/g) || []).length;
    return (uppercaseLetters / letters) >= 0.7;
}

function isLikelyMarginArtifact(text) {
    const line = normalizeLineText(text);
    if (!line) return false;
    if (line.length > 120) return false;
    if (/^(page\s+)?\d{1,4}$/.test(line.toLowerCase())) return true;
    if (line.includes(' ; ')) return false;
    if (looksMostlyUppercase(line)) return true;
    if (looksLikeHeadingLine(line)) return true;
    const words = line.split(/\s+/).filter(Boolean);
    return words.length <= 10;
}

function isLowSignalLine(text) {
    const line = normalizeLineText(text);
    if (!line) return true;

    const lower = line.toLowerCase();
    if (/^(page\s+)?\d{1,4}$/.test(lower)) return true;
    if (countLettersAndDigits(line) === 0) return true;

    if (line.includes('|')) {
        const pipeDensity = (line.match(/\|/g) || []).length / line.length;
        if (pipeDensity >= 0.12) return true;
    }

    if (line.includes(' ; ')) {
        const cells = line
            .split(';')
            .map((cell) => normalizeLineText(cell))
            .filter(Boolean);
        const shortCellCount = cells.filter((cell) => countLettersAndDigits(cell) <= 2).length;
        if (cells.length >= 5 && shortCellCount / cells.length >= 0.45) return true;
    }

    const alphaNum = countLettersAndDigits(line);
    const alphaRatio = alphaNum / line.length;
    if (line.length >= 20 && alphaRatio < 0.2) return true;

    const tokens = line.split(' ').filter(Boolean);
    if (tokens.length >= 6) {
        const avgTokenLength = tokens.join('').length / tokens.length;
        if (avgTokenLength <= 1.7) return true;
    }

    return false;
}

function dedupeAdjacentLines(lines) {
    const output = [];
    let previous = '';
    for (const line of lines) {
        const normalized = normalizeLineText(line);
        if (!normalized) continue;
        if (normalized.toLowerCase() === previous.toLowerCase()) continue;
        output.push(normalized);
        previous = normalized;
    }
    return output;
}

function dedupeNearbyLines(lines, windowSize = 10) {
    const output = [];
    const recentSignatures = [];

    for (const line of lines) {
        const normalized = normalizeLineText(line);
        if (!normalized) continue;

        const signature = canonicalizeForDedupe(normalized);
        const shouldDedupe = signature.length >= 18;
        if (shouldDedupe && recentSignatures.includes(signature)) continue;

        output.push(normalized);
        if (shouldDedupe) {
            recentSignatures.push(signature);
            if (recentSignatures.length > windowSize) {
                recentSignatures.shift();
            }
        }
    }

    return output;
}

function mergeHyphenatedWraps(lines) {
    const output = [];
    for (let i = 0; i < lines.length; i++) {
        const current = normalizeLineText(lines[i]);
        if (!current) continue;
        if (isColumnBreakMarker(current)) {
            output.push(current);
            continue;
        }

        const next = i + 1 < lines.length ? normalizeLineText(lines[i + 1]) : '';
        if (isColumnBreakMarker(next)) {
            output.push(current);
            continue;
        }
        const endsWithHyphen = /[\p{L}\p{N}]-$/u.test(current);
        const nextStartsLower = /^[\p{Ll}]/u.test(next);

        if (endsWithHyphen && nextStartsLower) {
            output.push(`${current.slice(0, -1)}${next}`);
            i += 1;
            continue;
        }

        output.push(current);
    }
    return output;
}

function mergeSoftWrappedLines(lines) {
    const output = [];
    for (let i = 0; i < lines.length; i++) {
        let current = normalizeLineText(lines[i]);
        if (!current) continue;

        while (i + 1 < lines.length) {
            const next = normalizeLineText(lines[i + 1]);
            if (!next) {
                i += 1;
                continue;
            }
            if (isColumnBreakMarker(current) || isColumnBreakMarker(next)) break;
            if (looksLikeListItem(current) || looksLikeListItem(next)) break;
            if (looksLikeHeadingLine(current) || looksLikeHeadingLine(next)) break;
            if (current.includes(' ; ') || next.includes(' ; ')) break;

            const currentEndsSoftly = /[a-z0-9,;:]$/u.test(current);
            const nextStartsSoftly = /^[a-z(]/u.test(next);
            const shouldMerge = (
                currentEndsSoftly &&
                nextStartsSoftly &&
                (current.length >= 35 || next.length >= 35)
            );
            if (!shouldMerge) break;

            current = `${current} ${next}`;
            i += 1;
        }

        output.push(current);
    }
    return output;
}

function detectRecurringMarginLines(pageLineGroups, marginDepth = 3, threshold = null) {
    const recurring = new Set();
    if (!Array.isArray(pageLineGroups) || pageLineGroups.length === 0) return recurring;

    const counts = new Map();
    const seenByPage = new Set();
    const normalizedThreshold = Number.isFinite(Number(threshold))
        ? Math.max(2, Math.floor(Number(threshold)))
        : Math.max(3, Math.ceil(pageLineGroups.length * 0.2));

    for (let pageIndex = 0; pageIndex < pageLineGroups.length; pageIndex++) {
        const pageLines = Array.isArray(pageLineGroups[pageIndex]) ? pageLineGroups[pageIndex] : [];
        const candidates = [
            ...pageLines.slice(0, marginDepth),
            ...pageLines.slice(Math.max(0, pageLines.length - marginDepth)),
        ];

        for (const rawLine of candidates) {
            const normalized = normalizeLineText(rawLine).toLowerCase();
            if (!normalized || normalized.length < 3) continue;
            if (!isLikelyMarginArtifact(normalized)) continue;
            const pageKey = `${pageIndex}:${normalized}`;
            if (seenByPage.has(pageKey)) continue;
            seenByPage.add(pageKey);
            counts.set(normalized, (counts.get(normalized) || 0) + 1);
        }
    }

    for (const [line, count] of counts.entries()) {
        if (count >= normalizedThreshold) {
            recurring.add(line);
        }
    }

    return recurring;
}

function cleanExtractedLines(lines, recurring) {
    let output = Array.isArray(lines)
        ? lines.map((line) => normalizeLineText(line)).filter((line) => line.length > 0)
        : [];
    const recurringSet = recurring instanceof Set ? recurring : new Set();
    output = output.filter((line) => isColumnBreakMarker(line) || !recurringSet.has(line.toLowerCase()));
    output = output.filter((line) => isColumnBreakMarker(line) || !isLowSignalLine(line));
    output = mergeHyphenatedWraps(output);
    output = mergeSoftWrappedLines(output);
    output = dedupeAdjacentLines(output);
    output = dedupeNearbyLines(output);
    return output.filter((line) => !isColumnBreakMarker(line));
}

async function extractTextFromPdf(buffer) {
    console.log(`[PDF] Starting extraction for buffer of size ${buffer.length}`);
    let pdfjs;
    try {
        // Try multiple import paths for Node compatibility
        try {
            pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        } catch {
            console.log('[PDF] Legacy import failed, trying standard build...');
            pdfjs = await import('pdfjs-dist/build/pdf.mjs');
        }
        console.log(`[PDF] pdfjs-dist imported successfully`);
    } catch (e) {
        console.error(`[PDF] Failed to import pdfjs-dist:`, e);
        throw new Error(`PDF library initialization failed: ${e.message}. Ensure pdfjs-dist is installed.`);
    }
    
    let pdf;
    try {
        const loadingTask = pdfjs.getDocument({
            data: new Uint8Array(buffer),
            useSystemFonts: true,
            disableFontFace: true,
            verbosity: 0,
            // Disable worker for Node.js to simplify environment
            stopAtErrors: false,
        });
        pdf = await loadingTask.promise;
        console.log(`[PDF] PDF loaded: ${pdf.numPages} pages`);
    } catch (e) {
        console.error(`[PDF] Failed to load document:`, e);
        throw new Error(`Failed to load PDF document: ${e.message}`);
    }

    const pages = [];
    const pageLineGroups = [];

    function flushColumnsToPageText(leftColumn, rightColumn) {
        if (leftColumn.length > 0 && rightColumn.length > 0) {
            return `${leftColumn.join("\n")}\n${COLUMN_BREAK_MARKER}\n${rightColumn.join("\n")}\n`;
        }
        if (leftColumn.length > 0) {
            return `${leftColumn.join("\n")}\n`;
        }
        if (rightColumn.length > 0) {
            return `${rightColumn.join("\n")}\n`;
        }
        return "";
    }

    for (let i = 1; i <= pdf.numPages; i++) {
        try {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.0 });
            const textContent = await page.getTextContent();
            const items = textContent.items;
            
            if (items.length === 0) continue;

            const midX = viewport.width / 2;
            const sortedItems = [...items].sort((a, b) => b.transform[5] - a.transform[5]);

            const lines = [];
            let currentLine = [];
            let lastY = -1;
            const yTolerance = 2;

            for (const item of sortedItems) {
                const y = item.transform[5];
                if (lastY === -1 || Math.abs(y - lastY) < yTolerance) {
                    currentLine.push(item);
                } else {
                    currentLine.sort((a, b) => a.transform[4] - b.transform[4]);
                    lines.push(currentLine);
                    currentLine = [item];
                }
                lastY = y;
            }
            if (currentLine.length > 0) {
                currentLine.sort((a, b) => a.transform[4] - b.transform[4]);
                lines.push(currentLine);
            }

            let pageText = "";
            const leftColumn = [];
            const rightColumn = [];

            lines.forEach((line) => {
                const lineText = normalizeLineText(line.map((item) => item.str).join(' '));
                if (!lineText) return;

                const gaps = [];
                for (let j = 1; j < line.length; j++) {
                    gaps.push(line[j].transform[4] - (line[j-1].transform[4] + (line[j-1].width || 0)));
                }
                const leftItems = line.filter((item) => item.transform[4] < midX);
                const rightItems = line.filter((item) => item.transform[4] >= midX);
                const hasBothColumns = leftItems.length > 0 && rightItems.length > 0;
                const largeGapCount = gaps.filter((gap) => gap > 24).length;
                const isTableRow = !hasBothColumns && line.length >= 4 && largeGapCount >= 2;

                const isSpanning = line.some(item => {
                    const x = item.transform[4];
                    const width = item.width || 0;
                    return (x < midX - 50 && (x + width) > midX + 50);
                }) || (line.length > 1 && line[0].transform[4] < midX - 100 && line[line.length-1].transform[4] > midX + 100);

                if (isTableRow) {
                    if (leftColumn.length > 0 || rightColumn.length > 0) {
                        pageText += flushColumnsToPageText(leftColumn, rightColumn);
                        leftColumn.length = 0;
                        rightColumn.length = 0;
                    }
                    const row = normalizeTableRowText(line.map((it) => it.str));
                    if (row) pageText += `${row}\n`;
                } else if (isSpanning) {
                    if (leftColumn.length > 0 || rightColumn.length > 0) {
                        pageText += flushColumnsToPageText(leftColumn, rightColumn);
                        leftColumn.length = 0;
                        rightColumn.length = 0;
                    }
                    pageText += `${lineText}\n`;
                } else {
                    if (leftItems.length > 0) {
                        const leftText = normalizeLineText(leftItems.map((it) => it.str).join(' '));
                        if (leftText) leftColumn.push(leftText);
                    }
                    if (rightItems.length > 0) {
                        const rightText = normalizeLineText(rightItems.map((it) => it.str).join(' '));
                        if (rightText) rightColumn.push(rightText);
                    }
                }
            });

            if (leftColumn.length > 0 || rightColumn.length > 0) {
                pageText += flushColumnsToPageText(leftColumn, rightColumn);
            }

            const pageLines = pageText
                .split('\n')
                .map((line) => normalizeLineText(line))
                .filter((line) => line.length > 0);
            pageLineGroups.push(pageLines);
            pages.push({ text: pageLines.join('\n'), page: i });
        } catch (e) {
            console.error(`[PDF] Error on page ${i}:`, e);
        }
    }

    const recurring = detectRecurringMarginLines(pageLineGroups);

    console.log(`[PDF] Extraction complete. Total pages extracted: ${pages.length}`);
    return pages.map(p => {
        const lines = cleanExtractedLines(p.text.split('\n'), recurring);
        return { text: lines.join("\n").trim(), page: p.page };
    });
}

module.exports = {
    extractTextFromPdf,
    __test: {
        cleanExtractedLines,
        COLUMN_BREAK_MARKER,
        detectRecurringMarginLines,
        dedupeNearbyLines,
        mergeHyphenatedWraps,
        mergeSoftWrappedLines,
        isLowSignalLine,
    },
};
