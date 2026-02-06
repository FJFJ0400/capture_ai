import type { FastifyReply } from "fastify";

export class ApiError extends Error {
  public statusCode: number;
  public code: string;
  public details?: Record<string, unknown>;

  constructor(message: string, code = "BAD_REQUEST", statusCode = 400, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const sendError = (reply: FastifyReply, error: ApiError): void => {
  reply.status(error.statusCode).send({
    error: {
      code: error.code,
      message: error.message,
      details: error.details
    }
  });
};
