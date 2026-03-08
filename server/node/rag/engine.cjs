const fs = require('fs/promises');
const path = require('path');
const nodeCrypto = require('crypto');
const { generateEmbeddings } = require('./embedding.cjs');
const { resolveEmbeddingModel } = require('./model.cjs');

const rulebookCache = new Map();
const DEFAULT_RAG_CACHE_MAX_ENTRIES = 50;
const ragCacheMaxEntries = (() => {
    const parsed = Number(process.env.RISU_RAG_CACHE_MAX_ENTRIES);
    if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_RAG_CACHE_MAX_ENTRIES;
    return Math.floor(parsed);
})();

function createInvalidRulebookIdError(bookId) {
    const error = new Error(`Invalid rulebook ID: ${bookId}`);
    error.code = 'INVALID_RULEBOOK_ID';
    return error;
}

function isSafePathSegment(segment) {
    return typeof segment === 'string' &&
        segment.length > 0 &&
        segment.length <= 128 &&
        !segment.includes('/') &&
        !segment.includes('\\') &&
        !segment.includes('\0') &&
        !segment.includes('..') &&
        segment !== '.';
}

function touchRulebookCache(bookId) {
    const entry = rulebookCache.get(bookId);
    if (!entry) return;
    entry.lastAccessMs = Date.now();
}

function evictOldestRulebookCacheEntry() {
    if (rulebookCache.size <= ragCacheMaxEntries) return;
    let oldestKey = null;
    let oldestTs = Number.POSITIVE_INFINITY;
    for (const [key, value] of rulebookCache.entries()) {
        const ts = Number(value?.lastAccessMs || 0);
        if (ts < oldestTs) {
            oldestTs = ts;
            oldestKey = key;
        }
    }
    if (oldestKey) {
        rulebookCache.delete(oldestKey);
    }
}

async function getCachedRulebook(bookId, dataDirs) {
    if (!isSafePathSegment(bookId)) {
        throw createInvalidRulebookIdError(bookId);
    }
    const cacheEntry = rulebookCache.get(bookId);
    const filePath = path.join(dataDirs.ragRulebooks, `${bookId}.json`);
    
    try {
        const stats = await fs.stat(filePath);
        const mtime = stats.mtimeMs;

        if (cacheEntry && cacheEntry.mtime === mtime) {
            touchRulebookCache(bookId);
            return cacheEntry.data;
        }

        const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
        rulebookCache.set(bookId, {
            data,
            mtime,
            lastAccessMs: Date.now(),
        });
        evictOldestRulebookCacheEntry();
        return data;
    } catch (e) {
        console.error(`[RAG] Failed to read rulebook ${bookId}:`, e);
        return null;
    }
}

/**
 * Similarity function (Cosine Similarity).
 */
function similarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }
    if (magA === 0 || magB === 0) return 0;
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function normalizeChunkContent(text) {
    if (typeof text !== 'string') return '';
    return text
        .replace(/\r\n?/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
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

function getAlphaNumericRatio(text) {
    if (typeof text !== 'string' || !text) return 0;
    const alphaNumericCount = countLettersAndDigits(text);
    return alphaNumericCount / text.length;
}

function looksLikeStructuredRow(line) {
    if (typeof line !== 'string') return false;
    if (!line.includes(' ; ')) return false;
    return line.split(' ; ').filter(Boolean).length >= 3;
}

function looksLikeListBlock(text) {
    if (typeof text !== 'string') return false;
    const lines = text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    if (lines.length < 2) return false;
    let structuredLines = 0;
    for (const line of lines) {
        if (/^[-*+]\s+/.test(line) || /^\d+[\.\)]\s+/.test(line)) {
            structuredLines += 1;
        }
    }
    return structuredLines >= 2;
}

function looksLikeHeading(line) {
    if (typeof line !== 'string') return false;
    const normalized = normalizeChunkContent(line);
    if (!normalized) return false;
    if (normalized.length > 90) return false;
    if (/[.!?]$/.test(normalized)) return false;
    const words = normalized.split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.length > 10) return false;
    return /^[A-Z0-9]/.test(normalized);
}

function looksStructurallyImportant(content) {
    if (typeof content !== 'string') return false;
    if (looksLikeListBlock(content)) return true;
    if (content.split('\n').some((line) => looksLikeStructuredRow(line))) return true;
    const lines = content.split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.length >= 2 && looksLikeHeading(lines[0])) return true;
    return false;
}

function isChunkContentUsable(content) {
    if (typeof content !== 'string') return false;
    const alphaNumericRatio = getAlphaNumericRatio(content);
    if (content.length >= 120) {
        return alphaNumericRatio >= 0.22;
    }
    if (content.length < 40) return false;
    if (!looksStructurallyImportant(content)) return false;
    if (alphaNumericRatio < 0.25) return false;
    return true;
}

function normalizeForContentDedupe(text) {
    if (typeof text !== 'string') return '';
    return text
        .toLowerCase()
        .replace(/\r\n?/g, '\n')
        .replace(/[^a-z0-9\s\n]/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{2,}/g, '\n')
        .trim();
}

function getTokenSetForDedupe(text) {
    const normalized = normalizeForContentDedupe(text);
    if (!normalized) return new Set();
    const tokens = normalized
        .split(/\s+/)
        .filter((token) => token.length >= 3)
        .slice(0, 200);
    return new Set(tokens);
}

function jaccardSimilarity(setA, setB) {
    if (setA.size === 0 || setB.size === 0) return 0;
    let intersection = 0;
    for (const token of setA) {
        if (setB.has(token)) intersection += 1;
    }
    const union = setA.size + setB.size - intersection;
    if (union === 0) return 0;
    return intersection / union;
}

function isNearDuplicateContent(a, b) {
    const normalizedA = normalizeForContentDedupe(a);
    const normalizedB = normalizeForContentDedupe(b);
    if (!normalizedA || !normalizedB) return false;
    if (normalizedA === normalizedB) return true;

    const tokensA = getTokenSetForDedupe(normalizedA);
    const tokensB = getTokenSetForDedupe(normalizedB);
    if (tokensA.size < 15 || tokensB.size < 15) return false;

    const similarityScore = jaccardSimilarity(tokensA, tokensB);
    return similarityScore >= 0.82;
}

function shouldKeepExpandedResult(selectedContents, candidateContent) {
    for (const selectedContent of selectedContents) {
        if (isNearDuplicateContent(selectedContent, candidateContent)) {
            return false;
        }
    }
    return true;
}

/**
 * Enhanced chunking logic with column and table awareness.
 */
function splitOversizedBlock(block, minChunkSize, maxChunkSize) {
    const parts = [];
    const overlap = 120;
    let start = 0;
    while (start < block.length) {
        let end = Math.min(block.length, start + maxChunkSize);
        if (end < block.length) {
            const lastDoubleNewline = block.lastIndexOf('\n\n', end);
            const lastNewline = block.lastIndexOf('\n', end);
            const lastSentence = Math.max(block.lastIndexOf('. ', end), block.lastIndexOf('? ', end), block.lastIndexOf('! ', end));
            const preferredBreak = [lastDoubleNewline, lastNewline, lastSentence]
                .find((index) => index > start + minChunkSize);
            if (typeof preferredBreak === 'number' && preferredBreak > start) {
                end = preferredBreak + (preferredBreak === lastSentence ? 1 : 0);
            }
        }
        const part = normalizeChunkContent(block.slice(start, end));
        if (part) {
            parts.push(part);
        }
        if (end >= block.length) break;
        start = Math.max(start + 1, end - overlap);
    }
    return parts;
}

function splitIntoSemanticBlocks(text, minChunkSize, maxChunkSize) {
    const normalized = normalizeChunkContent(text);
    if (!normalized) return [];

    const rawBlocks = normalized
        .split(/\n{2,}/)
        .map((block) => normalizeChunkContent(block))
        .filter(Boolean);

    const mergedBlocks = [];
    for (let i = 0; i < rawBlocks.length; i++) {
        const current = rawBlocks[i];
        const next = rawBlocks[i + 1];
        if (
            next &&
            looksLikeHeading(current) &&
            normalizeChunkContent(`${current}\n\n${next}`).length <= maxChunkSize
        ) {
            mergedBlocks.push(normalizeChunkContent(`${current}\n\n${next}`));
            i += 1;
            continue;
        }
        mergedBlocks.push(current);
    }

    const blocks = [];
    for (const block of mergedBlocks) {
        if (block.length <= maxChunkSize) {
            blocks.push(block);
            continue;
        }
        blocks.push(...splitOversizedBlock(block, minChunkSize, maxChunkSize));
    }
    return blocks;
}

function chunkText(text, source_file, page = null) {
    const chunks = [];
    const minChunkSize = 450;
    const maxChunkSize = 850;
    const blocks = splitIntoSemanticBlocks(text, minChunkSize, maxChunkSize);

    let pendingBlocks = [];
    let pendingLength = 0;

    const flushPending = () => {
        if (pendingBlocks.length === 0) return;
        const adjustedContent = normalizeChunkContent(pendingBlocks.join('\n\n'));
        if (!isChunkContentUsable(adjustedContent)) {
            pendingBlocks = [];
            pendingLength = 0;
            return;
        }
        chunks.push({
            id: nodeCrypto.randomUUID(),
            content: adjustedContent,
            embedding: null,
            metadata: {
                source_file,
                page,
                is_table: adjustedContent
                    .split('\n')
                    .some((line) => looksLikeStructuredRow(line)),
            }
        });
        pendingBlocks = [];
        pendingLength = 0;
    };

    for (const block of blocks) {
        if (!block) continue;
        const separatorCost = pendingBlocks.length > 0 ? 2 : 0;
        if (pendingLength + separatorCost + block.length <= maxChunkSize) {
            pendingBlocks.push(block);
            pendingLength += separatorCost + block.length;
            continue;
        }

        flushPending();

        pendingBlocks.push(block);
        pendingLength = block.length;

        if (pendingLength >= minChunkSize) {
            flushPending();
        }
    }

    flushPending();
    return chunks;
}

/**
 * Performs search across rulebooks.
 * Priority is used to boost scores and ensure preferred sources are ranked higher.
 */
async function searchRulebooks(query, bookIds, topK, minScore, modelName, dataDirs) {
    const queryText = (typeof query === 'string') ? query : String(query ?? '');
    if (!Array.isArray(bookIds)) {
        throw createInvalidRulebookIdError('bookIds must be an array');
    }
    for (const id of bookIds) {
        if (!isSafePathSegment(id)) {
            throw createInvalidRulebookIdError(id);
        }
    }
    console.log(`[RAG-Perf] Starting search for "${queryText.substring(0, 30)}..." in ${bookIds.length} books.`);
    const requestedModel = resolveEmbeddingModel(modelName || 'MiniLM');
    const queryEmbeddingByModel = new Map();

    async function getQueryEmbedding(modelKey) {
        const resolved = resolveEmbeddingModel(modelKey || requestedModel.key);
        if (queryEmbeddingByModel.has(resolved.key)) {
            return {
                embedding: queryEmbeddingByModel.get(resolved.key),
                resolved,
            };
        }
        const embedStart = Date.now();
        const embedding = (await generateEmbeddings([queryText], resolved.key))[0];
        queryEmbeddingByModel.set(resolved.key, embedding);
        console.log(`[RAG-Perf] Query embedding model=${resolved.key} (${resolved.modelName}) took ${Date.now() - embedStart}ms.`);
        return { embedding, resolved };
    }

    await getQueryEmbedding(requestedModel.key);

    const allBookResults = [];
    let totalDimMismatchCount = 0;

    for (const id of bookIds) {
        try {
            const data = await getCachedRulebook(id, dataDirs);
            if (!data) continue;

            const bookEmbeddingModel = (typeof data.embeddingModel === 'string' && data.embeddingModel.trim())
                ? data.embeddingModel.trim()
                : requestedModel.key;
            const { embedding: queryEmbedding, resolved: resolvedBookModel } = await getQueryEmbedding(bookEmbeddingModel);

            const chunks = data.chunks || [];
            const bookPriority = data.priority || 0;
            const bookResults = [];
            let dimMismatchCount = 0;

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                if (!Array.isArray(chunk?.embedding) || chunk.embedding.length !== queryEmbedding.length) {
                    dimMismatchCount += 1;
                    continue;
                }
                const score = similarity(queryEmbedding, chunk.embedding);
                
                // Boost score based on priority
                const finalScore = score + (bookPriority * 0.05);

                if (finalScore >= minScore) {
                    bookResults.push({
                        index: i,
                        chunk: {
                            id: chunk.id,
                            content: chunk.content,
                            metadata: {
                                ...chunk.metadata,
                                embeddingModel: bookEmbeddingModel,
                            }
                        },
                        score: finalScore,
                        originalScore: score,
                        priority: bookPriority,
                        bookId: id
                    });
                }
            }
            
            // Sort this book's results and take the best
            bookResults.sort((a, b) => b.score - a.score);
            totalDimMismatchCount += dimMismatchCount;
            if (dimMismatchCount > 0) {
                console.warn(
                    `[RAG] Skipped ${dimMismatchCount} chunk(s) with embedding dimension mismatch in book ${id}. requested=${requestedModel.key}, bookModel=${resolvedBookModel.key}`
                );
            }
            if (bookResults.length > 0) {
                allBookResults.push({
                    bookId: id,
                    results: bookResults,
                    bestScore: bookResults[0].score,
                    allChunks: chunks
                });
            }
        } catch (e) {
            console.error(`[RAG] Failed to search book ${id}:`, e);
        }
    }

    if (totalDimMismatchCount > 0) {
        console.warn(`[RAG] Total chunks skipped due to embedding dimension mismatch: ${totalDimMismatchCount}`);
    }

    // Source Diversity: Round-robin selection
    allBookResults.sort((a, b) => b.bestScore - a.bestScore);

    const finalResults = [];
    const usedChunkIds = new Set(); // Track unique chunks to prevent duplicates from expansion
    const selectedContents = [];

    // Pass 1: Take the best from each book
    for (const bookEntry of allBookResults) {
        if (finalResults.length >= topK) break;
        const best = bookEntry.results[0];
        
        if (usedChunkIds.has(best.chunk.id)) continue;

        const expanded = expandAndFormat(best, bookEntry.allChunks);
        if (!shouldKeepExpandedResult(selectedContents, expanded.chunk.content)) {
            continue;
        }
        finalResults.push(expanded);
        selectedContents.push(expanded.chunk.content);
        
        // Mark this chunk and its immediate neighbors as "used"
        usedChunkIds.add(best.chunk.id);
        if (best.index > 0) usedChunkIds.add(bookEntry.allChunks[best.index - 1].id);
        if (best.index < bookEntry.allChunks.length - 1) usedChunkIds.add(bookEntry.allChunks[best.index + 1].id);
    }

    // Pass 2: Fill remaining slots with next best overall
    if (finalResults.length < topK) {
        const remaining = allBookResults.flatMap(b => b.results).filter(r => !usedChunkIds.has(r.chunk.id));
        remaining.sort((a, b) => b.score - a.score);
        
        for (const res of remaining) {
            if (finalResults.length >= topK) break;
            if (usedChunkIds.has(res.chunk.id)) continue;

            const bookEntry = allBookResults.find(b => b.bookId === res.bookId);
            const expanded = expandAndFormat(res, bookEntry.allChunks);
            if (!shouldKeepExpandedResult(selectedContents, expanded.chunk.content)) {
                continue;
            }
            finalResults.push(expanded);
            selectedContents.push(expanded.chunk.content);
            
            usedChunkIds.add(res.chunk.id);
            if (res.index > 0) usedChunkIds.add(bookEntry.allChunks[res.index - 1].id);
            if (res.index < bookEntry.allChunks.length - 1) usedChunkIds.add(bookEntry.allChunks[res.index + 1].id);
        }
    }

    return finalResults;
}

/**
 * Merges a chunk with its neighbors for better context expansion.
 */
function expandAndFormat(result, allChunks) {
    const idx = result.index;
    let content = result.chunk.content;

    const shouldPrependNeighbor = /^[a-z(]/.test(content.trimStart());
    const shouldAppendNeighbor = (
        content.length >= 500 &&
        !/[.!?:"')\]]$/.test(content.trimEnd())
    );

    if (
        shouldPrependNeighbor &&
        idx > 0 &&
        !result.chunk.metadata.is_table
    ) {
        const prev = allChunks[idx - 1];
        if (
            prev.metadata.page === result.chunk.metadata.page &&
            !prev.metadata?.is_table &&
            isChunkContentUsable(prev.content) &&
            !isNearDuplicateContent(prev.content, content)
        ) {
            content = prev.content + "\n" + content;
        }
    }

    if (
        shouldAppendNeighbor &&
        idx < allChunks.length - 1 &&
        !result.chunk.metadata.is_table
    ) {
        const next = allChunks[idx + 1];
        if (
            next.metadata.page === result.chunk.metadata.page &&
            !next.metadata?.is_table &&
            isChunkContentUsable(next.content) &&
            !isNearDuplicateContent(next.content, content)
        ) {
            content = content + "\n" + next.content;
        }
    }

    return {
        chunk: {
            ...result.chunk,
            content: content
        },
        score: result.score
    };
}

/**
 * Updates rulebook metadata.
 */
async function updateRulebookMetadata(id, name, metadata, dataDirs, priority = null) {
    if (!isSafePathSegment(id)) {
        throw createInvalidRulebookIdError(id);
    }
    const filePath = path.join(dataDirs.ragRulebooks, `${id}.json`);
    const content = JSON.parse(await fs.readFile(filePath, 'utf-8'));
    
    if (name) content.name = name;
    if (priority !== null && priority !== undefined) content.priority = priority;
    if (metadata) {
        content.metadata = { ...content.metadata, ...metadata };
        // Sync chunk metadata
        if (content.chunks) {
            content.chunks.forEach(c => {
                if (metadata.system !== undefined) c.metadata.system = metadata.system;
                if (metadata.edition !== undefined) c.metadata.edition = metadata.edition;
            });
        }
    }
    content.updatedAt = Date.now();
    
    await fs.writeFile(filePath, JSON.stringify(content, null, 2));
    return { 
        id, 
        name: content.name, 
        metadata: content.metadata, 
        chunkCount: content.chunkCount || content.chunks?.length || 0,
        thumbnail: content.thumbnail,
        priority: content.priority || 0,
        embeddingModel: content.embeddingModel || null,
    };
}

module.exports = {
    chunkText,
    searchRulebooks,
    updateRulebookMetadata,
    getCachedRulebook,
    __test: {
        isChunkContentUsable,
        splitIntoSemanticBlocks,
        expandAndFormat,
        looksStructurallyImportant,
    },
};
