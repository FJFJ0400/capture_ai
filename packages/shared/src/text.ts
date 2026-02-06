import { CAPTURE_CATEGORIES, type ActionSuggestion, type CaptureCategory } from "./types";

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "from",
  "your",
  "have",
  "will",
  "are",
  "you",
  "our",
  "but",
  "not",
  "was",
  "were",
  "has",
  "had",
  "into",
  "about",
  "over",
  "under",
  "when",
  "where",
  "who",
  "what",
  "why",
  "how",
  "can",
  "could",
  "would",
  "should",
  "email",
  "phone",
  "www",
  "http",
  "https",
  "com"
]);

export const normalizeText = (input: string): string =>
  input
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim();

export const generateSummary = (text: string, fallbackLabel: string): string => {
  const cleaned = text.trim();
  if (!cleaned) return `No OCR text found. Source: ${fallbackLabel}.`;
  const sentences = cleaned
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
  const summary = sentences.slice(0, 2).join(" ");
  return summary.length > 400 ? `${summary.slice(0, 400)}...` : summary;
};

type PurposeProfileInput = {
  name: string;
  instruction: string;
  sampleKeywords: string[];
};

const instructionKeywords = (instruction: string): string[] =>
  normalizeText(instruction)
    .toLowerCase()
    .split(" ")
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token))
    .slice(0, 12);

export const organizeByPurpose = (
  text: string,
  profile: PurposeProfileInput,
  fallbackLabel: string
): { purposeSummary: string; purposeChecklist: string[] } => {
  const cleaned = text.trim();
  const sentences = cleaned
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
  const keywords = [
    ...new Set([
      ...profile.sampleKeywords.map((value) => value.toLowerCase()),
      ...instructionKeywords(profile.instruction)
    ])
  ];

  const matchedSentences = keywords.length
    ? sentences.filter((sentence) => keywords.some((keyword) => sentence.toLowerCase().includes(keyword)))
    : [];

  const purposeSummary = matchedSentences.slice(0, 3).join(" ") || generateSummary(cleaned, fallbackLabel);

  const checklist: string[] = [];
  const dateMatches = cleaned.match(/\b\d{4}[./-]\d{1,2}[./-]\d{1,2}\b/g) ?? [];
  const timeMatches = cleaned.match(/\b\d{1,2}:\d{2}\b/g) ?? [];
  const amountMatches = cleaned.match(/[$₩€£]\s?\d[\d,]*(\.\d+)?/g) ?? [];

  dateMatches.slice(0, 2).forEach((value) => checklist.push(`일정 확인: ${value}`));
  timeMatches.slice(0, 2).forEach((value) => checklist.push(`시간 확인: ${value}`));
  amountMatches.slice(0, 2).forEach((value) => checklist.push(`금액 확인: ${value}`));

  matchedSentences.slice(0, 3).forEach((value) => {
    const clipped = value.length > 120 ? `${value.slice(0, 120)}...` : value;
    checklist.push(`핵심 문장 검토: ${clipped}`);
  });

  if (!checklist.length) {
    checklist.push(`${profile.name} 목적 기준으로 핵심 내용을 검토하고 후속 작업을 등록하세요.`);
  }

  return {
    purposeSummary,
    purposeChecklist: [...new Set(checklist)].slice(0, 6)
  };
};

export const classifyCategory = (text: string): CaptureCategory => {
  const lowered = text.toLowerCase();
  const matches: Array<[CaptureCategory, RegExp]> = [
    ["receipt", /(total|subtotal|tax|receipt|thank you|amount due)/i],
    ["reservation", /(reservation|booking|check-in|check out|seat|confirmation)/i],
    ["finance", /(invoice|statement|balance|payment|due date|bank|account)/i],
    ["shopping", /(order|cart|shipping|delivery|tracking|item)/i],
    ["study", /(chapter|lesson|course|homework|assignment|quiz)/i],
    ["chat", /(chat|message|conversation|dm|reply)/i],
    ["document", /(report|document|memo|proposal|agenda|minutes)/i]
  ];
  for (const [category, regex] of matches) {
    if (regex.test(lowered)) return category;
  }
  return "misc";
};

export const extractTags = (text: string, maxTags = 6): string[] => {
  const normalized = normalizeText(text).toLowerCase();
  if (!normalized) return [];
  const counts = new Map<string, number>();
  for (const token of normalized.split(" ")) {
    if (!token || token.length < 3 || STOPWORDS.has(token)) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTags)
    .map(([word]) => word);
};

export const generateActionSuggestions = (category: CaptureCategory): ActionSuggestion[] => {
  const suggestionsByCategory: Record<CaptureCategory, ActionSuggestion[]> = {
    receipt: [
      { title: "Expense 기록", reason: "지출 내역을 즉시 남길 수 있습니다." },
      { title: "환불/교환 일정 확인", reason: "기한을 놓치지 않도록 합니다." },
      { title: "월간 지출 요약", reason: "카테고리별 합계를 추적합니다." }
    ],
    reservation: [
      { title: "캘린더 등록", reason: "시간을 잊지 않도록 합니다." },
      { title: "장소/주소 저장", reason: "이동 준비를 빠르게 합니다." },
      { title: "동행자 공유", reason: "필요한 정보를 공유합니다." }
    ],
    document: [
      { title: "핵심 요약 확인", reason: "중요 포인트를 빠르게 파악합니다." },
      { title: "다음 행동 등록", reason: "문서 후속 작업을 명확히 합니다." },
      { title: "관련 링크 저장", reason: "추가 자료로 이어집니다." }
    ],
    chat: [
      { title: "답장 작성", reason: "대화 맥락을 이어갑니다." },
      { title: "할 일로 전환", reason: "요청 사항을 잊지 않습니다." },
      { title: "중요 문장 저장", reason: "핵심 대화를 보관합니다." }
    ],
    study: [
      { title: "학습 노트 저장", reason: "복습을 쉽게 만듭니다." },
      { title: "다음 학습 계획", reason: "진도를 유지합니다." },
      { title: "키워드 암기", reason: "핵심 용어를 기억합니다." }
    ],
    shopping: [
      { title: "배송 일정 확인", reason: "도착 시점을 놓치지 않습니다." },
      { title: "리스트에 추가", reason: "반복 구매를 쉽게 합니다." },
      { title: "예산 비교", reason: "지출을 관리합니다." }
    ],
    finance: [
      { title: "납부 일정 등록", reason: "연체를 방지합니다." },
      { title: "지출 카테고리 분류", reason: "재무 흐름을 파악합니다." },
      { title: "알림 설정", reason: "중요 기한을 기억합니다." }
    ],
    misc: [
      { title: "메모로 저장", reason: "추가 정리가 필요합니다." },
      { title: "관련 태그 추가", reason: "나중에 찾기 쉽습니다." },
      { title: "할 일로 변환", reason: "다음 행동을 명확히 합니다." }
    ]
  };

  return suggestionsByCategory[category] ?? suggestionsByCategory.misc;
};

export const ensureCategory = (value: string): CaptureCategory => {
  const lowered = value.toLowerCase();
  return (CAPTURE_CATEGORIES as readonly string[]).includes(lowered)
    ? (lowered as CaptureCategory)
    : "misc";
};
