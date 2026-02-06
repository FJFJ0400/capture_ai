import { describe, expect, it } from "vitest";
import { classifyCategory, extractTags, generateSummary, organizeByPurpose } from "./text";

describe("text utilities", () => {
  it("generates a fallback summary when text is empty", () => {
    const summary = generateSummary("", "receipt.png");
    expect(summary).toContain("receipt.png");
  });

  it("classifies receipts by keyword", () => {
    const category = classifyCategory("Subtotal: $10.00 Tax: $1.00");
    expect(category).toBe("receipt");
  });

  it("extracts top tags", () => {
    const tags = extractTags("meeting agenda agenda agenda notes notes next steps", 3);
    expect(tags.length).toBeGreaterThan(0);
    expect(tags).toContain("agenda");
  });

  it("organizes text by purpose", () => {
    const result = organizeByPurpose(
      "2026-02-06 회의 일정 확정. 총 금액은 $42.00 입니다.",
      {
        name: "업무 정리",
        instruction: "일정과 금액을 우선 정리",
        sampleKeywords: ["일정", "금액"]
      },
      "sample.png"
    );
    expect(result.purposeSummary.length).toBeGreaterThan(0);
    expect(result.purposeChecklist.length).toBeGreaterThan(0);
  });
});
