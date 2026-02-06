import crypto from "crypto";

type StagedFile = {
  name: string;
  type: string;
  size: number;
  base64: string;
};

type StagedPayload = {
  createdAt: number;
  files: StagedFile[];
};

type ShareStore = Map<string, StagedPayload>;

const STALE_MS = 1000 * 60 * 20;

const getStore = (): ShareStore => {
  const key = "__capture_ai_share_store__";
  const scoped = globalThis as unknown as Record<string, ShareStore | undefined>;
  if (!scoped[key]) {
    scoped[key] = new Map<string, StagedPayload>();
  }
  return scoped[key] as ShareStore;
};

const prune = (store: ShareStore): void => {
  const now = Date.now();
  for (const [token, payload] of store.entries()) {
    if (now - payload.createdAt > STALE_MS) {
      store.delete(token);
    }
  }
};

export const stageShareFiles = (files: StagedFile[]): string => {
  const store = getStore();
  prune(store);
  const token = crypto.randomUUID();
  store.set(token, {
    createdAt: Date.now(),
    files
  });
  return token;
};

export const getStagedShare = (token: string): StagedPayload | null => {
  const store = getStore();
  prune(store);
  return store.get(token) ?? null;
};

export const removeStagedShare = (token: string): void => {
  const store = getStore();
  store.delete(token);
};
