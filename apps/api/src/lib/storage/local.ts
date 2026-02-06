import fs from "fs/promises";
import path from "path";
import { decryptBuffer, encryptBuffer } from "../crypto";

export type StorageAdapter = {
  save: (buffer: Buffer, storageKey: string) => Promise<void>;
  read: (storageKey: string) => Promise<Buffer>;
  remove: (storageKey: string) => Promise<void>;
  resolvePath: (storageKey: string) => string;
};

export const createLocalStorage = (rootPath: string, encryptionKey: string): StorageAdapter => {
  const resolvePath = (storageKey: string): string => path.resolve(rootPath, storageKey);

  const save = async (buffer: Buffer, storageKey: string): Promise<void> => {
    const absolutePath = resolvePath(storageKey);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    const encrypted = encryptBuffer(buffer, encryptionKey);
    await fs.writeFile(absolutePath, encrypted);
  };

  const read = async (storageKey: string): Promise<Buffer> => {
    const absolutePath = resolvePath(storageKey);
    const payload = await fs.readFile(absolutePath);
    return decryptBuffer(payload, encryptionKey);
  };

  const remove = async (storageKey: string): Promise<void> => {
    const absolutePath = resolvePath(storageKey);
    try {
      await fs.unlink(absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  };

  return { save, read, remove, resolvePath };
};
