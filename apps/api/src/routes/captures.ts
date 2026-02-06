import type { FastifyInstance } from "fastify";
import crypto from "crypto";
import { z } from "zod";
import { ApiError } from "../lib/errors";
import { hashBuffer } from "../lib/hash";
import { isAllowedExtension, isAllowedMime, sanitizeFilename } from "../lib/file";
import { CAPTURE_CATEGORIES, CAPTURE_STATUSES, type CaptureCategory, type CaptureStatus } from "@capture-ai/shared";
import { env } from "../env";

const querySchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  purposeId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional()
});

const serializeCapture = (item: any) => ({
  ...item,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString()
});

const queueJob = async (app: FastifyInstance, captureId: string): Promise<void> => {
  try {
    await app.captureQueue.add("process-capture", { captureId }, { jobId: captureId });
  } catch (error) {
    const message = (error as Error).message ?? "";
    if (!message.includes("JobId")) throw error;
  }
};

export default async function capturesRoutes(app: FastifyInstance): Promise<void> {
  app.post("/captures", async (request, reply) => {
    if (!request.isMultipart()) {
      throw new ApiError("Multipart form-data required.", "UNSUPPORTED_MEDIA_TYPE", 415);
    }

    const allowedMimeTypes = env.ALLOWED_MIME_TYPES
      .split(",")
      .map((value) => value.trim());

    let purposeId: string | null = null;
    const files: Array<{ filename: string; mimetype: string; buffer: Buffer }> = [];

    for await (const part of request.parts()) {
      if (part.type === "file") {
        if (!isAllowedMime(part.mimetype, allowedMimeTypes)) {
          throw new ApiError("Unsupported file type.", "UNSUPPORTED_MEDIA_TYPE", 415, {
            mimeType: part.mimetype
          });
        }

        if (!isAllowedExtension(part.filename, part.mimetype)) {
          throw new ApiError("Unsupported file extension.", "UNSUPPORTED_MEDIA_TYPE", 415, {
            filename: part.filename
          });
        }

        const buffer = await part.toBuffer();
        if (buffer.byteLength > env.MAX_UPLOAD_BYTES) {
          throw new ApiError("Uploaded file exceeds size limit.", "FILE_TOO_LARGE", 413);
        }

        files.push({
          filename: part.filename || "upload",
          mimetype: part.mimetype,
          buffer
        });
        continue;
      }

      if (part.fieldname === "purposeId") {
        const value = String(part.value ?? "").trim();
        purposeId = value || null;
      }
    }

    if (!files.length) {
      throw new ApiError("No files provided.", "NO_FILES", 400);
    }

    if (purposeId) {
      const purpose = await app.prisma.capturePurpose.findUnique({ where: { id: purposeId } });
      if (!purpose || !purpose.isActive) {
        throw new ApiError("Invalid purpose.", "INVALID_PURPOSE", 400);
      }
    } else {
      const fallbackPurpose = await app.prisma.capturePurpose.findFirst({
        where: { isDefault: true, isActive: true },
        orderBy: { createdAt: "asc" }
      });
      purposeId = fallbackPurpose?.id ?? null;
    }

    const results: Array<{ item: unknown; duplicate: boolean }> = [];

    for (const file of files) {
      const fileHash = hashBuffer(file.buffer);
      const existing = await app.prisma.captureItem.findUnique({ where: { fileHash } });

      if (existing) {
        const shouldReprocess = existing.status !== "DONE" || existing.purposeId !== purposeId;
        const updated = shouldReprocess
          ? await app.prisma.captureItem.update({
              where: { id: existing.id },
              data: {
                purposeId,
                status: "UPLOADED",
                category: null,
                summary: null,
                purposeSummary: null,
                purposeChecklist: [],
                ocrText: null,
                tags: [],
                actionSuggestions: [],
                failureReason: null
              }
            })
          : existing;

        if (shouldReprocess) {
          await queueJob(app, updated.id);
        }

        results.push({ item: serializeCapture(updated), duplicate: true });
        continue;
      }

      const id = crypto.randomUUID();
      const safeName = sanitizeFilename(file.filename);
      const storageKey = `captures/${id}/${safeName}`;

      await app.storage.save(file.buffer, storageKey);

      const item = await app.prisma.captureItem.create({
        data: {
          id,
          originalFilename: safeName,
          mimeType: file.mimetype,
          sizeBytes: file.buffer.byteLength,
          storageKey,
          fileHash,
          status: "UPLOADED",
          tags: [],
          purposeChecklist: [],
          purposeId
        }
      });

      await queueJob(app, id);
      results.push({ item: serializeCapture(item), duplicate: false });
    }

    reply.status(201).send({ data: results });
  });

  app.get("/captures", async (request, reply) => {
    const { query, category, status, purposeId, from, to } = querySchema.parse(request.query);

    const where: Record<string, unknown> = {};

    if (category) {
      if (!(CAPTURE_CATEGORIES as readonly string[]).includes(category)) {
        throw new ApiError("Invalid category.", "INVALID_CATEGORY", 400);
      }
      where.category = category as CaptureCategory;
    }

    if (status) {
      if (!(CAPTURE_STATUSES as readonly string[]).includes(status)) {
        throw new ApiError("Invalid status.", "INVALID_STATUS", 400);
      }
      where.status = status as CaptureStatus;
    }

    if (purposeId) {
      where.purposeId = purposeId;
    }

    if (from || to) {
      const createdAt: { gte?: Date; lte?: Date } = {};
      if (from) {
        const parsed = new Date(from);
        if (Number.isNaN(parsed.getTime())) throw new ApiError("Invalid from date.", "INVALID_DATE", 400);
        createdAt.gte = parsed;
      }
      if (to) {
        const parsed = new Date(to);
        if (Number.isNaN(parsed.getTime())) throw new ApiError("Invalid to date.", "INVALID_DATE", 400);
        createdAt.lte = parsed;
      }
      where.createdAt = createdAt;
    }

    if (query) {
      where.OR = [
        { ocrText: { contains: query, mode: "insensitive" } },
        { summary: { contains: query, mode: "insensitive" } },
        { purposeSummary: { contains: query, mode: "insensitive" } },
        { originalFilename: { contains: query, mode: "insensitive" } },
        { tags: { has: query.toLowerCase() } }
      ];
    }

    const items = await app.prisma.captureItem.findMany({
      where,
      orderBy: { createdAt: "desc" }
    });

    reply.send({ data: items.map(serializeCapture) });
  });

  app.get("/captures/stream", async (request, reply) => {
    const query = z
      .object({
        captureId: z.string().optional(),
        since: z.string().optional()
      })
      .parse(request.query);

    let lastSeen = query.since ? new Date(query.since) : new Date(0);
    if (Number.isNaN(lastSeen.getTime())) {
      lastSeen = new Date(0);
    }

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    reply.hijack();

    const sendEvent = (event: string, payload: unknown) => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const tick = async () => {
      try {
        const where: Record<string, unknown> = {
          updatedAt: { gt: lastSeen }
        };
        if (query.captureId) where.id = query.captureId;

        const updates = await app.prisma.captureItem.findMany({
          where,
          orderBy: { updatedAt: "asc" }
        });

        const latest = updates.at(-1);
        if (updates.length && latest) {
          lastSeen = latest.updatedAt;
          sendEvent("update", updates.map(serializeCapture));
        }

        sendEvent("ping", { at: new Date().toISOString() });
      } catch (error) {
        sendEvent("error", { message: (error as Error).message ?? "Stream error" });
      }
    };

    const interval = setInterval(() => {
      void tick();
    }, 3000);

    void tick();

    request.raw.on("close", () => {
      clearInterval(interval);
    });
  });

  app.get("/captures/:id", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const item = await app.prisma.captureItem.findUnique({ where: { id: params.id } });
    if (!item) throw new ApiError("Capture not found.", "NOT_FOUND", 404);
    reply.send({ data: serializeCapture(item) });
  });

  app.get("/captures/:id/file", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const item = await app.prisma.captureItem.findUnique({ where: { id: params.id } });
    if (!item) throw new ApiError("Capture not found.", "NOT_FOUND", 404);
    const buffer = await app.storage.read(item.storageKey);
    reply
      .header("Content-Type", item.mimeType)
      .header("Cache-Control", "no-store")
      .send(buffer);
  });

  app.post("/captures/:id/retry", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const item = await app.prisma.captureItem.findUnique({ where: { id: params.id } });
    if (!item) throw new ApiError("Capture not found.", "NOT_FOUND", 404);
    if (item.status === "DONE") {
      throw new ApiError("Capture already processed.", "ALREADY_DONE", 409);
    }

    await app.prisma.captureItem.update({
      where: { id: params.id },
      data: { status: "UPLOADED", failureReason: null }
    });

    await queueJob(app, params.id);

    reply.send({ data: { id: params.id, status: "UPLOADED" } });
  });

  app.delete("/captures/:id", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const item = await app.prisma.captureItem.findUnique({ where: { id: params.id } });
    if (!item) throw new ApiError("Capture not found.", "NOT_FOUND", 404);

    await app.prisma.todoItem.updateMany({
      where: { sourceCaptureId: params.id },
      data: { sourceCaptureId: null }
    });

    await app.storage.remove(item.storageKey);
    await app.prisma.captureItem.delete({ where: { id: params.id } });

    reply.send({ data: { id: params.id } });
  });
}
