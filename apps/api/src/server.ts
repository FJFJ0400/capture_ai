import Fastify from "fastify";
import multipart from "@fastify/multipart";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import { env } from "./env";
import prismaPlugin from "./plugins/prisma";
import storagePlugin from "./plugins/storage";
import queuePlugin from "./plugins/queue";
import authPlugin from "./plugins/auth";
import captureRoutes from "./routes/captures";
import chatRoutes from "./routes/chat";
import purposeRoutes from "./routes/purposes";
import todoRoutes from "./routes/todos";
import { ApiError, sendError } from "./lib/errors";

const app = Fastify({
  logger: {
    level: env.LOG_LEVEL
  }
});

app.register(rateLimit, { max: 60, timeWindow: "1 minute" });
app.register(cors, { origin: true });
app.register(multipart, {
  limits: {
    fileSize: env.MAX_UPLOAD_BYTES,
    files: 10
  }
});

app.setErrorHandler((error, request, reply) => {
  if (error instanceof ApiError) {
    return sendError(reply, error);
  }
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request payload.",
        details: error.flatten()
      }
    });
  }
  if ((error as { code?: string }).code === "FST_ERR_MULTIPART_FILE_TOO_LARGE") {
    return reply.status(413).send({
      error: {
        code: "FILE_TOO_LARGE",
        message: "Uploaded file exceeds size limit."
      }
    });
  }

  request.log.error({ err: error, reqId: request.id }, "Unhandled error");
  return reply.status(500).send({
    error: {
      code: "INTERNAL_ERROR",
      message: "Unexpected server error."
    }
  });
});

app.get("/health", async () => ({ ok: true }));

app.register(prismaPlugin);
app.register(storagePlugin);
app.register(queuePlugin);

app.register(
  async (v1) => {
    await v1.register(authPlugin);
    await v1.register(captureRoutes);
    await v1.register(chatRoutes);
    await v1.register(purposeRoutes);
    await v1.register(todoRoutes);
  },
  { prefix: "/v1" }
);

app.listen({ port: env.PORT, host: "0.0.0.0" }).catch((error) => {
  app.log.error({ err: error }, "Failed to start API");
  process.exit(1);
});
