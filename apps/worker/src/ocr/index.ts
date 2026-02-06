import { createWorker } from "tesseract.js";
import { env } from "../env";

export type OcrAdapter = {
  extract: (input: Buffer, filename: string) => Promise<string>;
};

export const getOcrAdapter = (name: string): OcrAdapter => {
  switch (name) {
    case "tesseract":
      return tesseractAdapter;
    case "placeholder":
    default:
      return placeholderAdapter;
  }
};

const placeholderAdapter: OcrAdapter = {
  async extract(_input, filename) {
    return `OCR placeholder output for ${filename}.`;
  }
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`OCR timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });

const tesseractAdapter: OcrAdapter = {
  async extract(input, filename) {
    let worker: Awaited<ReturnType<typeof createWorker>> | null = null;

    try {
      worker = await withTimeout(createWorker(env.OCR_LANG), env.OCR_TIMEOUT_MS);
      const { data } = await withTimeout(worker.recognize(input), env.OCR_TIMEOUT_MS);
      return data.text ?? "";
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown OCR error";
      return `OCR fallback output for ${filename}. Tesseract failed: ${reason}`;
    } finally {
      if (worker) {
        await worker.terminate().catch(() => undefined);
      }
    }
  }
};
