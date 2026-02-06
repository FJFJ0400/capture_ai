import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ApiError } from "../lib/errors";

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  instruction: z.string().min(1),
  sampleKeywords: z.array(z.string().min(1)).default([]),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional()
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  instruction: z.string().min(1).optional(),
  sampleKeywords: z.array(z.string().min(1)).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional()
});

const serializePurpose = (item: any) => ({
  ...item,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString()
});

export default async function purposeRoutes(app: FastifyInstance): Promise<void> {
  app.get("/purposes", async (_request, reply) => {
    let items = await app.prisma.capturePurpose.findMany({
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]
    });
    if (!items.length) {
      const seed = await app.prisma.capturePurpose.create({
        data: {
          name: "일반 정리",
          description: "기본 인입함 정리 목적",
          instruction: "핵심 내용을 빠르게 파악하고 후속 작업을 체크리스트로 정리합니다.",
          sampleKeywords: ["일정", "금액", "요청"],
          isDefault: true,
          isActive: true
        }
      });
      items = [seed];
    }
    reply.send({ data: items.map(serializePurpose) });
  });

  app.post("/purposes", async (request, reply) => {
    const payload = createSchema.parse(request.body);

    const created = await app.prisma.$transaction(async (tx) => {
      if (payload.isDefault) {
        await tx.capturePurpose.updateMany({ data: { isDefault: false } });
      }

      return tx.capturePurpose.create({
        data: {
          name: payload.name,
          description: payload.description ?? null,
          instruction: payload.instruction,
          sampleKeywords: payload.sampleKeywords,
          isDefault: payload.isDefault ?? false,
          isActive: payload.isActive ?? true
        }
      });
    });

    reply.status(201).send({ data: serializePurpose(created) });
  });

  app.patch("/purposes/:id", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const payload = updateSchema.parse(request.body);

    const exists = await app.prisma.capturePurpose.findUnique({ where: { id: params.id } });
    if (!exists) throw new ApiError("Purpose not found.", "NOT_FOUND", 404);

    const updated = await app.prisma.$transaction(async (tx) => {
      if (payload.isDefault) {
        await tx.capturePurpose.updateMany({ data: { isDefault: false } });
      }

      return tx.capturePurpose.update({
        where: { id: params.id },
        data: {
          name: payload.name,
          description: payload.description,
          instruction: payload.instruction,
          sampleKeywords: payload.sampleKeywords,
          isDefault: payload.isDefault,
          isActive: payload.isActive
        }
      });
    });

    reply.send({ data: serializePurpose(updated) });
  });

  app.delete("/purposes/:id", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const purpose = await app.prisma.capturePurpose.findUnique({ where: { id: params.id } });
    if (!purpose) throw new ApiError("Purpose not found.", "NOT_FOUND", 404);

    await app.prisma.$transaction(async (tx) => {
      await tx.captureItem.updateMany({
        where: { purposeId: params.id },
        data: { purposeId: null }
      });
      await tx.capturePurpose.delete({ where: { id: params.id } });

      if (purpose.isDefault) {
        const fallback = await tx.capturePurpose.findFirst({ where: { isActive: true } });
        if (fallback) {
          await tx.capturePurpose.update({ where: { id: fallback.id }, data: { isDefault: true } });
        }
      }
    });

    reply.send({ data: { id: params.id } });
  });
}
