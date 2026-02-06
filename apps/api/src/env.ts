import path from "path";
import dotenv from "dotenv";
import { z } from "zod";

const rootEnv = path.resolve(process.cwd(), "../../.env");
const localEnv = path.resolve(process.cwd(), ".env");

dotenv.config({ path: rootEnv });
dotenv.config({ path: localEnv });

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  API_KEY: z.string().min(6),
  PORT: z.coerce.number().int().positive().default(4000),
  STORAGE_LOCAL_PATH: z.string().min(1),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_ENCRYPTION_KEY: z.string().length(64),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  ALLOWED_MIME_TYPES: z.string().default("image/png,image/jpeg,image/webp"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false),
  LOG_LEVEL: z.string().default("info")
});

export const env = schema.parse(process.env);

if (env.STORAGE_DRIVER === "s3") {
  const missing: string[] = [];
  if (!env.S3_BUCKET) missing.push("S3_BUCKET");
  if (!env.S3_ACCESS_KEY_ID) missing.push("S3_ACCESS_KEY_ID");
  if (!env.S3_SECRET_ACCESS_KEY) missing.push("S3_SECRET_ACCESS_KEY");
  if (missing.length) {
    throw new Error(`Missing required S3 env: ${missing.join(", ")}`);
  }
}
