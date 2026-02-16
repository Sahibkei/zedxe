import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import type { BlogPostRecord } from "@/lib/blog/service";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 52;
const MARGIN_TOP = 52;
const MARGIN_BOTTOM = 52;

const sanitizePdfText = (value: string): string => value.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");

const wrapText = (text: string, font: PDFFont, size: number, maxWidth: number): string[] => {
    const source = sanitizePdfText(text);
    if (!source.trim()) return [];

    const words = source.split(/\s+/);
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
        const candidate = currentLine ? `${currentLine} ${word}` : word;
        const width = font.widthOfTextAtSize(candidate, size);

        if (width <= maxWidth) {
            currentLine = candidate;
            continue;
        }

        if (currentLine) {
            lines.push(currentLine);
            currentLine = word;
            continue;
        }

        lines.push(word);
    }

    if (currentLine) lines.push(currentLine);
    return lines;
};

export const generateBlogPostPdf = async (post: BlogPostRecord): Promise<Uint8Array> => {
    const pdfDoc = await PDFDocument.create();
    const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let page: PDFPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let cursorY = PAGE_HEIGHT - MARGIN_TOP;
    const maxLineWidth = PAGE_WIDTH - MARGIN_X * 2;

    const addPage = () => {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        cursorY = PAGE_HEIGHT - MARGIN_TOP;
    };

    const drawLine = (
        line: string,
        {
            font,
            size,
            color = rgb(0.1, 0.1, 0.1),
            lineHeight,
        }: { font: PDFFont; size: number; color?: ReturnType<typeof rgb>; lineHeight: number },
    ) => {
        if (cursorY - lineHeight < MARGIN_BOTTOM) addPage();

        page.drawText(sanitizePdfText(line), {
            x: MARGIN_X,
            y: cursorY,
            font,
            size,
            color,
        });
        cursorY -= lineHeight;
    };

    for (const line of wrapText(post.title, boldFont, 22, maxLineWidth)) {
        drawLine(line, { font: boldFont, size: 22, color: rgb(0.02, 0.18, 0.38), lineHeight: 30 });
    }

    cursorY -= 6;

    const metadata = `Published ${post.publishedAt.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    })}  |  Author: ${post.authorName}`;
    drawLine(metadata, { font: bodyFont, size: 11, color: rgb(0.33, 0.33, 0.33), lineHeight: 18 });

    cursorY -= 8;

    for (const line of wrapText(post.excerpt, bodyFont, 12, maxLineWidth)) {
        drawLine(line, { font: bodyFont, size: 12, color: rgb(0.25, 0.25, 0.25), lineHeight: 18 });
    }

    cursorY -= 10;

    const paragraphs = post.content
        .split(/\n{2,}/)
        .map((part) => part.trim())
        .filter(Boolean);

    for (const paragraph of paragraphs) {
        const paragraphLines = paragraph
            .split("\n")
            .flatMap((segment) => wrapText(segment.trim(), bodyFont, 12, maxLineWidth));

        for (const line of paragraphLines) {
            drawLine(line, { font: bodyFont, size: 12, color: rgb(0.08, 0.08, 0.08), lineHeight: 18 });
        }

        cursorY -= 10;
    }

    return pdfDoc.save();
};
