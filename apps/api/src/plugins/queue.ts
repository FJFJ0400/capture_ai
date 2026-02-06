import fp from "fastify-plugin";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "../env";

declare module "fastify" {
  interface FastifyInstance {
    captureQueue: Queue;
  }
}

export default fp(async (app) => {
  const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue("capture-jobs", {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 1000
    }
  });

  app.decorate("captureQueue", queue);

  app.addHook("onClose", async () => {
    await queue.close();
    await connection.quit();
  });
});
