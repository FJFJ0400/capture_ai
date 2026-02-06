import crypto from "crypto";

export const hashBuffer = (buffer: Buffer): string =>
  crypto.createHash("sha256").update(buffer).digest("hex");
