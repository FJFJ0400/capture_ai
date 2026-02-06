import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ApiError } from "../lib/errors";

const createSchema = z.object({
  title: z.string().min(1),
  sourceCaptureId: z.string().optional()
});

const updateSchema = z.object({
  done: z.boolean()
});

const serializeTodo = (item: any) => ({
  ...item,
  createdAt: item.createdAt.toISOString()
});

export default async function todoRoutes(app: FastifyInstance): Promise<void> {
  app.post("/todos", async (request, reply) => {
    const payload = createSchema.parse(request.body);

    if (payload.sourceCaptureId) {
      const exists = await app.prisma.captureItem.findUnique({ where: { id: payload.sourceCaptureId } });
      if (!exists) throw new ApiError("Capture not found for todo.", "NOT_FOUND", 404);
    }

    const todo = await app.prisma.todoItem.create({
      data: {
        title: payload.title,
        sourceCaptureId: payload.sourceCaptureId ?? null
      }
    });

    reply.status(201).send({ data: serializeTodo(todo) });
  });

  app.get("/todos", async (_request, reply) => {
    const items = await app.prisma.todoItem.findMany({
      orderBy: { createdAt: "desc" }
    });
    reply.send({ data: items.map(serializeTodo) });
  });

  app.patch("/todos/:id", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const payload = updateSchema.parse(request.body);
    const todo = await app.prisma.todoItem.findUnique({ where: { id: params.id } });
    if (!todo) throw new ApiError("Todo not found.", "NOT_FOUND", 404);

    const updated = await app.prisma.todoItem.update({
      where: { id: params.id },
      data: { done: payload.done }
    });

    reply.send({ data: serializeTodo(updated) });
  });

  app.delete("/todos/:id", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const todo = await app.prisma.todoItem.findUnique({ where: { id: params.id } });
    if (!todo) throw new ApiError("Todo not found.", "NOT_FOUND", 404);

    await app.prisma.todoItem.delete({ where: { id: params.id } });
    reply.send({ data: { id: params.id } });
  });
}
