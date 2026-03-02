import * as pdfjs from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?worker&url";

if (typeof window !== "undefined") {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

export interface PdfPageContent {
  text: string;
  page: number;
  tables: string[];
}

/**
 * Enhanced PDF extractor with column awareness, basic table detection, and recurring garbage filtering.
 */
export async function extractPdfData(data: Uint8Array): Promise<{ pages: PdfPageContent[], thumbnail?: string }> {
  const loadingTask = pdfjs.getDocument({
    data,
    cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
  });
  const pdf = await loadingTask.promise;
  const pages: PdfPageContent[] = [];

  // 1. Extract Thumbnail from first page (if in browser)
  let thumbnail: string | undefined = undefined;
  if (typeof window !== "undefined" && pdf.numPages > 0) {
    try {
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.5 }); // Low res for thumb
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({
            canvasContext: context!,
            viewport: viewport
        }).promise;
        
        thumbnail = canvas.toDataURL('image/webp', 0.7);
    } catch {
    }
  }

  // Used for global filtering (headers/footers)
  const firstLines: string[] = [];
  const lastLines: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();
    
    const items = textContent.items as Array<{ str: string; transform: number[]; width?: number }>;
    if (items.length === 0) continue;

    // Midpoint for column detection
    const midX = viewport.width / 2;
    
    // Sort items by Y descending (top to bottom)
    const sortedItems = [...items].sort((a, b) => b.transform[5] - a.transform[5]);

    // Group items into horizontal "lines"
    const lines: Array<Array<{ str: string; transform: number[]; width?: number }>> = [];
    let currentLine: Array<{ str: string; transform: number[]; width?: number }> = [];
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

    // Process lines into columns and tables
    let pageText = "";
    const leftColumn: string[] = [];
    const rightColumn: string[] = [];

    lines.forEach((line) => {
      const lineText = line.map(item => item.str).join(" ").trim();
      if (!lineText) return;

      // 3. Table Handling (Heuristic)
      // If a line has multiple items with significant gaps, it might be a table row
      const gaps = [];
      for (let j = 1; j < line.length; j++) {
        gaps.push(line[j].transform[4] - (line[j-1].transform[4] + (line[j-1].width || 0)));
      }
      const isTableRow = gaps.some(g => g > 20) && line.length > 2;

      const isSpanning = line.some(item => {
        const x = item.transform[4];
        const width = item.width || 0;
        return (x < midX - 50 && (x + width) > midX + 50);
      }) || (line.length > 1 && line[0].transform[4] < midX - 100 && line[line.length-1].transform[4] > midX + 100);

      if (isTableRow) {
        // Flush columns first
        if (leftColumn.length > 0 || rightColumn.length > 0) {
          pageText += leftColumn.join("\n") + "\n" + rightColumn.join("\n") + "\n";
          leftColumn.length = 0;
          rightColumn.length = 0;
        }
        // Format as markdown-ish row
        const row = "| " + line.map(it => it.str.trim()).join(" | ") + " |";
        pageText += row + "\n";
      } else if (isSpanning) {
        if (leftColumn.length > 0 || rightColumn.length > 0) {
          pageText += leftColumn.join("\n") + "\n" + rightColumn.join("\n") + "\n";
          leftColumn.length = 0;
          rightColumn.length = 0;
        }
        pageText += lineText + "\n";
      } else {
        const leftItems = line.filter(item => item.transform[4] < midX);
        const rightItems = line.filter(item => item.transform[4] >= midX);
        if (leftItems.length > 0) leftColumn.push(leftItems.map(it => it.str).join(" "));
        if (rightItems.length > 0) rightColumn.push(rightItems.map(it => it.str).join(" "));
      }
    });

    if (leftColumn.length > 0 || rightColumn.length > 0) {
      pageText += leftColumn.join("\n") + "\n" + rightColumn.join("\n") + "\n";
    }

    const pageLines = pageText.split("\n").filter(l => l.trim());
    if (pageLines.length > 0) {
      firstLines.push(pageLines[0]);
      lastLines.push(pageLines[pageLines.length - 1]);
    }

    pages.push({
      text: pageText,
      page: i,
      tables: [] // Structured table extraction can be added here
    });
  }

  // 2. OCR Cleaning & "Garbage" Filtering
  const recurring = new Set<string>();
  const threshold = Math.max(3, pdf.numPages * 0.20); // Present in >20% of pages

  const countOccurrences = (arr: string[]) => {
    const counts: Record<string, number> = {};
    arr.forEach(line => {
      const normalized = line.trim().toLowerCase();
      if (normalized.length < 3) return; // Skip very short strings
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

  pages.forEach(p => {
    let lines = p.text.split("\n");
    lines = lines.filter(line => !recurring.has(line.trim().toLowerCase()));
    
    // Improved page number stripping (matches "Page X" or just "X")
    if (lines.length > 0 && /^(page\s+)?\d+$/i.test(lines[0].trim())) lines.shift();
    if (lines.length > 0 && /^(page\s+)?\d+$/i.test(lines[lines.length - 1].trim())) lines.pop();

    p.text = lines.join("\n").trim();
  });

  const totalTextLength = pages.reduce((acc, p) => acc + p.text.length, 0);
  const avgTextLengthPerPage = pdf.numPages > 0 ? totalTextLength / pdf.numPages : 0;
  
  if (pdf.numPages > 0 && avgTextLengthPerPage < 50) {
    throw new Error(
      "The PDF appears to be scanned or contains very little text. " +
      "RAG requires a text-based PDF or a scanned PDF that has been processed with OCR."
    );
  }

  return { pages, thumbnail };
}

export async function extractTextFromPdf(data: Uint8Array): Promise<PdfPageContent[]> {
    const res = await extractPdfData(data);
    return res.pages;
}
