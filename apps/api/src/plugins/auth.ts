import type { FastifyInstance } from "fastify";
import { env } from "../env";

export default async function authPlugin(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", async (request, reply) => {
    const headerKey = request.headers["x-api-key"];
    const resolvedHeader = Array.isArray(headerKey) ? headerKey[0] : headerKey;
    const queryKey =
      typeof (request.query as { apiKey?: string } | undefined)?.apiKey === "string"
        ? (request.query as { apiKey?: string }).apiKey
        : undefined;
    const apiKey = resolvedHeader ?? queryKey;
    if (apiKey !== env.API_KEY) {
      return reply.status(401).send({
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid API key."
        }
      });
    }
  });
}
