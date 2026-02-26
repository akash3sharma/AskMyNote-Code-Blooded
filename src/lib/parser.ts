import { PDFParse } from "pdf-parse";

import { isLLMEnabled } from "@/lib/env";
import { ocrImageWithLLM } from "@/lib/llm";
import { cleanText } from "@/lib/utils";
import type { ParsedSection } from "@/lib/types";

function hasReadablePdfText(sections: ParsedSection[]) {
  if (sections.length === 0) return false;

  const merged = sections.map((section) => section.text).join(" ");
  const letters = (merged.match(/[a-zA-Z]/g) || []).length;
  if (letters < 80) return false;

  const pageMarkerPattern = /--\s*\d+\s*of\s*\d+\s*--/gi;
  const markerHits = (merged.match(pageMarkerPattern) || []).length;
  if (markerHits >= 3 && letters < 180) {
    return false;
  }

  return true;
}

async function renderPdfPagesToDataUrls(buffer: Buffer, maxPages = 10) {
  const { createCanvas } = await import("@napi-rs/canvas");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  }).promise;

  const totalPages = Math.min(document.numPages, maxPages);
  const pages: Array<{ pageNumber: number; imageDataUrl: string }> = [];

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.6 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext("2d");

    const renderContext: Parameters<typeof page.render>[0] = {
      canvasContext: context as unknown as Parameters<typeof page.render>[0]["canvasContext"],
      canvas: canvas as unknown as Parameters<typeof page.render>[0]["canvas"],
      viewport,
    };

    await page.render(renderContext).promise;
    const imageBuffer = canvas.toBuffer("image/png");
    const imageDataUrl = `data:image/png;base64,${imageBuffer.toString("base64")}`;
    pages.push({ pageNumber, imageDataUrl });
  }

  return pages;
}

async function parsePdfWithOcr(buffer: Buffer): Promise<ParsedSection[]> {
  if (!isLLMEnabled()) {
    return [];
  }

  const pageImages = await renderPdfPagesToDataUrls(buffer, 10);
  const sections: ParsedSection[] = [];

  for (const page of pageImages) {
    const extracted = await ocrImageWithLLM({
      imageDataUrl: page.imageDataUrl,
      pageNumber: page.pageNumber,
    });

    if (!extracted) continue;

    const text = cleanText(extracted);
    if (!text) continue;

    sections.push({
      pageOrSection: `Page ${page.pageNumber}`,
      text,
    });
  }

  return sections;
}

async function parsePdf(buffer: Buffer): Promise<ParsedSection[]> {
  const parser = new PDFParse({ data: buffer });

  try {
    const parsed = await parser.getText();
    const sections =
      parsed.pages
        ?.map((page) => ({
          pageOrSection: `Page ${page.num}`,
          text: cleanText(page.text || ""),
        }))
        .filter((section) => section.text.length > 0) ?? [];

    if (sections.length > 0) {
      if (hasReadablePdfText(sections)) {
        return sections;
      }

      const ocrSections = await parsePdfWithOcr(buffer);
      if (ocrSections.length > 0) {
        return ocrSections;
      }

      return sections;
    }

    if (parsed.text) {
      const textSection = [{ pageOrSection: "Page 1", text: cleanText(parsed.text) }];
      if (hasReadablePdfText(textSection)) {
        return textSection;
      }

      const ocrSections = await parsePdfWithOcr(buffer);
      if (ocrSections.length > 0) {
        return ocrSections;
      }

      return textSection;
    }

    return parsePdfWithOcr(buffer);
  } finally {
    await parser.destroy();
  }
}

function parseTxt(buffer: Buffer): ParsedSection[] {
  const text = cleanText(buffer.toString("utf-8"));
  return text ? [{ pageOrSection: "Section 1", text }] : [];
}

export async function parseUploadedContent(params: {
  buffer: Buffer;
  mimeType: string;
  extension: string;
}) {
  const { buffer, mimeType, extension } = params;

  if (mimeType === "application/pdf" || extension === "pdf") {
    return parsePdf(buffer);
  }

  if (mimeType.startsWith("text/") || extension === "txt" || extension === "md") {
    return parseTxt(buffer);
  }

  throw new Error("Unsupported file type. Upload PDF or TXT files only.");
}
