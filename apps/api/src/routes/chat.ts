import type { FastifyInstance } from "fastify";
import { z } from "zod";

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "your",
  "have",
  "will",
  "are",
  "you",
  "our",
  "was",
  "were",
  "has",
  "had",
  "into",
  "about",
  "when",
  "where",
  "what",
  "why",
  "how",
  "can",
  "could",
  "would",
  "should",
  "http",
  "https",
  "com",
  "그리고",
  "하지만",
  "에서",
  "에게",
  "으로",
  "입니다",
  "있다",
  "없다",
  "저장",
  "기록",
  "해줘",
  "해주세요",
  "이거",
  "그거"
]);

const chatSchema = z.object({
  message: z.string().trim().min(2).max(600),
  captureId: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(5).default(3),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(600)
      })
    )
    .max(8)
    .optional()
});

type CaptureRecord = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  originalFilename: string;
  summary: string | null;
  purposeSummary: string | null;
  ocrText: string | null;
  tags: string[];
  actionSuggestions: unknown;
};

type ScoredCapture = CaptureRecord & {
  score: number;
};

type ChatReference = {
  id: string;
  originalFilename: string;
  createdAt: string;
  summary: string | null;
  purposeSummary: string | null;
  tags: string[];
  score: number;
};

const normalize = (input: string): string =>
  input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (input: string): string[] =>
  normalize(input)
    .split(" ")
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));

const unique = (items: string[]): string[] => [...new Set(items)];

const toActionTitles = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const titles: string[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const title = (entry as { title?: unknown }).title;
    if (typeof title === "string" && title.trim()) {
      titles.push(title.trim());
    }
  }
  return unique(titles).slice(0, 3);
};

const clip = (value: string, max: number): string => (value.length > max ? `${value.slice(0, max)}...` : value);

const scoreCapture = (item: CaptureRecord, queryTokens: string[], captureId?: string): number => {
  const context = `${item.summary ?? ""} ${item.purposeSummary ?? ""} ${item.ocrText ?? ""}`;
  const tokenSet = new Set(tokenize(context));
  const loweredTags = new Set(item.tags.map((tag) => normalize(tag)));

  let overlap = 0;
  for (const token of queryTokens) {
    if (tokenSet.has(token)) overlap += 1;
  }

  let tagOverlap = 0;
  for (const token of queryTokens) {
    if (loweredTags.has(token)) tagOverlap += 1;
  }

  const ageHours = Math.max(1, (Date.now() - item.updatedAt.getTime()) / (1000 * 60 * 60));
  const recencyBoost = 1 / Math.log2(ageHours + 2);
  const targetBoost = captureId && item.id === captureId ? 3 : 0;

  return overlap * 3 + tagOverlap * 4 + recencyBoost + targetBoost;
};

const toReference = (item: ScoredCapture): ChatReference => ({
  id: item.id,
  originalFilename: item.originalFilename,
  createdAt: item.createdAt.toISOString(),
  summary: item.summary,
  purposeSummary: item.purposeSummary,
  tags: item.tags.slice(0, 6),
  score: Number(item.score.toFixed(2))
});

export default async function chatRoutes(app: FastifyInstance): Promise<void> {
  app.post("/chat/query", async (request, reply) => {
    const payload = chatSchema.parse(request.body);

    const where = payload.captureId
      ? { id: payload.captureId, status: "DONE" as const }
      : { status: "DONE" as const };

    const captures = (await app.prisma.captureItem.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: payload.captureId ? 1 : 120,
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        originalFilename: true,
        summary: true,
        purposeSummary: true,
        ocrText: true,
        tags: true,
        actionSuggestions: true
      }
    })) as CaptureRecord[];

    if (!captures.length) {
      return reply.send({
        data: {
          answer:
            "아직 분석이 완료된 스크린샷이 없습니다. 먼저 모바일에서 공유 후 저장하기를 눌러 캡처를 기록해 주세요.",
          references: [] as ChatReference[],
          followUps: ["지금 막 저장한 스크린샷 상태 보여줘", "최근 저장된 항목 3개 요약해줘"]
        }
      });
    }

    const userHistory = (payload.history ?? [])
      .filter((entry) => entry.role === "user")
      .map((entry) => entry.content)
      .join(" ");
    const queryTokens = unique(tokenize(`${payload.message} ${userHistory}`));

    const ranked = captures
      .map((item) => ({
        ...item,
        score: scoreCapture(item, queryTokens, payload.captureId)
      }))
      .sort((a, b) => b.score - a.score);

    const matched = ranked.filter((item) => item.score > 0);
    const selected = (matched.length ? matched : ranked).slice(0, payload.limit);
    const references = selected.map(toReference);

    const keyActions = unique(selected.flatMap((item) => toActionTitles(item.actionSuggestions))).slice(0, 3);

    const lines: string[] = [];
    lines.push(`요청하신 질문: ${payload.message}`);
    lines.push("저장된 스크린샷 기준으로 정리하면 아래가 핵심입니다.");
    references.forEach((ref, index) => {
      const summary = ref.purposeSummary ?? ref.summary ?? "요약이 아직 생성되지 않았습니다.";
      const tagsLine = ref.tags.length ? ` (태그: ${ref.tags.map((tag) => `#${tag}`).join(", ")})` : "";
      lines.push(`${index + 1}. ${ref.originalFilename}: ${clip(summary, 180)}${tagsLine}`);
    });
    if (keyActions.length) {
      lines.push(`바로 실행할 만한 다음 행동: ${keyActions.join(", ")}`);
    }
    lines.push("원하면 특정 항목을 지정해서 일정/금액/요청사항만 다시 추출해 드릴게요.");

    const followUps = [
      "이 내용에서 일정/시간만 추려줘",
      "가장 중요한 할 일 3개로 정리해줘",
      "다음에 물어볼 체크 질문을 제안해줘"
    ];

    return reply.send({
      data: {
        answer: lines.join("\n"),
        references,
        followUps
      }
    });
  });
}
