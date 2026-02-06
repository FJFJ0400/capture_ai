import crypto from "crypto";

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export const parseHexKey = (hexKey: string): Buffer => {
  if (!hexKey || hexKey.length !== 64) {
    throw new Error("STORAGE_ENCRYPTION_KEY must be 64 hex characters (32 bytes).");
  }
  return Buffer.from(hexKey, "hex");
};

export const encryptBuffer = (plain: Buffer, hexKey: string): Buffer => {
  const key = parseHexKey(hexKey);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
};

export const decryptBuffer = (payload: Buffer, hexKey: string): Buffer => {
  const key = parseHexKey(hexKey);
  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = payload.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
};
