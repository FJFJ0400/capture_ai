import path from "path";
import { PrismaClient } from "@prisma/client";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { env } from "./env";
import { createLocalStorage } from "./lib/storage/local";
import { createS3Storage } from "./lib/storage/s3";
import { getOcrAdapter } from "./ocr";
import { processCapture } from "./pipeline/processCapture";

const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
const prisma = new PrismaClient();

const storage =
  env.STORAGE_DRIVER === "s3"
    ? createS3Storage({
        endpoint: env.S3_ENDPOINT,
        region: env.S3_REGION,
        bucket: env.S3_BUCKET ?? "",
        accessKeyId: env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? "",
        forcePathStyle: env.S3_FORCE_PATH_STYLE,
        encryptionKey: env.STORAGE_ENCRYPTION_KEY
      })
    : createLocalStorage(
        path.isAbsolute(env.STORAGE_LOCAL_PATH)
          ? env.STORAGE_LOCAL_PATH
          : path.resolve(process.cwd(), "../../", env.STORAGE_LOCAL_PATH),
        env.STORAGE_ENCRYPTION_KEY
      );
const ocrAdapter = getOcrAdapter(env.OCR_ADAPTER);

const worker = new Worker(
  "capture-jobs",
  async (job) => {
    const captureId = job.data.captureId as string;
    await processCapture(captureId, prisma, storage, ocrAdapter);
  },
  {
    connection,
    concurrency: 2
  }
);

worker.on("failed", async (job, error) => {
  if (!job) return;
  const captureId = job.data.captureId as string;
  const reason = (error?.message ?? "Unknown error").slice(0, 500);
  await prisma.captureItem
    .update({
      where: { id: captureId },
      data: { status: "FAILED", failureReason: reason }
    })
    .catch(() => undefined);
});

const shutdown = async () => {
  await worker.close();
  await prisma.$disconnect();
  await connection.quit();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("Worker running...");
