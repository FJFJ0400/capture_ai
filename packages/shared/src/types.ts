export const CAPTURE_STATUSES = ["UPLOADED", "PROCESSING", "DONE", "FAILED"] as const;
export type CaptureStatus = (typeof CAPTURE_STATUSES)[number];

export const CAPTURE_CATEGORIES = [
  "receipt",
  "reservation",
  "document",
  "chat",
  "study",
  "shopping",
  "finance",
  "misc"
] as const;
export type CaptureCategory = (typeof CAPTURE_CATEGORIES)[number];

export type ActionSuggestion = {
  title: string;
  reason: string;
};

export type CaptureItemDTO = {
  id: string;
  createdAt: string;
  updatedAt: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  fileHash: string;
  status: CaptureStatus;
  category: CaptureCategory | null;
  summary: string | null;
  purposeSummary: string | null;
  purposeChecklist: string[];
  ocrText: string | null;
  tags: string[];
  actionSuggestions: ActionSuggestion[] | null;
  failureReason: string | null;
  purposeId: string | null;
};

export type TodoItemDTO = {
  id: string;
  createdAt: string;
  title: string;
  sourceCaptureId: string | null;
  done: boolean;
};

export type CapturePurposeDTO = {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  description: string | null;
  instruction: string;
  sampleKeywords: string[];
  isDefault: boolean;
  isActive: boolean;
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};
