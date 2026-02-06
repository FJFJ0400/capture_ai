import fp from "fastify-plugin";
import path from "path";
import { env } from "../env";
import { createLocalStorage, type StorageAdapter } from "../lib/storage/local";
import { createS3Storage } from "../lib/storage/s3";

declare module "fastify" {
  interface FastifyInstance {
    storage: StorageAdapter;
  }
}

export default fp(async (app) => {
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
  app.decorate("storage", storage);
});
