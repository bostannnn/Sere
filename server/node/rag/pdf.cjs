/**
 * Enhanced PDF extractor with column awareness and basic filtering for Node.js.
 */
function normalizeLineText(text) {
    if (typeof text !== 'string') return '';
    return text
        .replace(/\0/g, '')
        .replace(/\s+/g, ' ')
        .trim();
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

function countLettersAndDigits(text) {
    if (typeof text !== 'string') return 0;
    try {
        return (text.match(/[\p{L}\p{N}]/gu) || []).length;
    } catch {
        return (text.match(/[A-Za-z0-9]/g) || []).length;
    }
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

        const next = i + 1 < lines.length ? normalizeLineText(lines[i + 1]) : '';
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

function cleanExtractedLines(lines, recurring) {
    let output = Array.isArray(lines)
        ? lines.map((line) => normalizeLineText(line)).filter((line) => line.length > 0)
        : [];
    const recurringSet = recurring instanceof Set ? recurring : new Set();
    output = output.filter((line) => !recurringSet.has(line.toLowerCase()));
    output = output.filter((line) => !isLowSignalLine(line));
    output = mergeHyphenatedWraps(output);
    output = dedupeAdjacentLines(output);
    output = dedupeNearbyLines(output);
    return output;
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
    const firstLines = [];
    const lastLines = [];

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
                        pageText += leftColumn.join("\n") + "\n" + rightColumn.join("\n") + "\n";
                        leftColumn.length = 0;
                        rightColumn.length = 0;
                    }
                    const row = normalizeTableRowText(line.map((it) => it.str));
                    if (row) pageText += `${row}\n`;
                } else if (isSpanning) {
                    if (leftColumn.length > 0 || rightColumn.length > 0) {
                        pageText += leftColumn.join("\n") + "\n" + rightColumn.join("\n") + "\n";
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
                pageText += leftColumn.join("\n") + "\n" + rightColumn.join("\n") + "\n";
            }

            const pageLines = pageText
                .split('\n')
                .map((line) => normalizeLineText(line))
                .filter((line) => line.length > 0);
            if (pageLines.length > 0) {
                firstLines.push(pageLines[0]);
                lastLines.push(pageLines[pageLines.length - 1]);
            }

            pages.push({ text: pageLines.join('\n'), page: i });
        } catch (e) {
            console.error(`[PDF] Error on page ${i}:`, e);
        }
    }

    const recurring = new Set();
    const threshold = Math.max(3, pdf.numPages * 0.20);

    const countOccurrences = (arr) => {
        const counts = {};
        arr.forEach(line => {
            const normalized = line.trim().toLowerCase();
            if (normalized.length < 3) return;
            counts[normalized] = (counts[normalized] || 0) + 1;
        });
        return counts;
    };

    const firstLineCounts = countOccurrences(firstLines);
    const lastLineCounts = countOccurrences(lastLines);

    Object.entries(firstLineCounts).forEach(([line, count]) => {
        if (count >= threshold) recurring.add(line);
    });
    Object.entries(lastLineCounts).forEach(([line, count]) => {
        if (count >= threshold) recurring.add(line);
    });

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
        dedupeNearbyLines,
        mergeHyphenatedWraps,
        isLowSignalLine,
    },
};
