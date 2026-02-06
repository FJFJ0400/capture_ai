import type { PrismaClient } from "@prisma/client";
import type { OcrAdapter } from "../ocr";
import type { StorageAdapter } from "../lib/storage/local";
import {
  classifyCategory,
  extractTags,
  generateActionSuggestions,
  generateSummary,
  organizeByPurpose
} from "@capture-ai/shared";

const OCR_TEXT_LIMIT = 6000;

export const processCapture = async (
  captureId: string,
  prisma: PrismaClient,
  storage: StorageAdapter,
  ocrAdapter: OcrAdapter
): Promise<void> => {
  const item = await prisma.captureItem.findUnique({
    where: { id: captureId },
    include: { purpose: true }
  });
  if (!item) {
    throw new Error(`Capture not found: ${captureId}`);
  }
  if (item.status === "DONE") return;

  await prisma.captureItem.update({
    where: { id: captureId },
    data: { status: "PROCESSING" }
  });

  const buffer = await storage.read(item.storageKey);
  const ocrText = await ocrAdapter.extract(buffer, item.originalFilename);
  const trimmedText = ocrText.trim().slice(0, OCR_TEXT_LIMIT);
  const category = classifyCategory(trimmedText);
  const summary = generateSummary(trimmedText, item.originalFilename);
  const tags = extractTags(trimmedText, 8);
  const actionSuggestions = generateActionSuggestions(category);
  const purposeResult =
    item.purpose && item.purpose.isActive
      ? organizeByPurpose(
          trimmedText,
          {
            name: item.purpose.name,
            instruction: item.purpose.instruction,
            sampleKeywords: item.purpose.sampleKeywords
          },
          item.originalFilename
        )
      : null;

  await prisma.captureItem.update({
    where: { id: captureId },
    data: {
      status: "DONE",
      category,
      summary,
      purposeSummary: purposeResult?.purposeSummary ?? null,
      purposeChecklist: purposeResult?.purposeChecklist ?? [],
      ocrText: trimmedText,
      tags,
      actionSuggestions,
      failureReason: null
    }
  });
};
