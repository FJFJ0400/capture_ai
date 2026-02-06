import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import { decryptBuffer, encryptBuffer } from "../crypto";

export type StorageAdapter = {
  save: (buffer: Buffer, storageKey: string) => Promise<void>;
  read: (storageKey: string) => Promise<Buffer>;
  remove: (storageKey: string) => Promise<void>;
  resolvePath: (storageKey: string) => string;
};

type S3StorageConfig = {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
  encryptionKey: string;
};

const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

export const createS3Storage = (config: S3StorageConfig): StorageAdapter => {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    },
    forcePathStyle: config.forcePathStyle ?? false
  });

  const resolvePath = (storageKey: string): string => storageKey;

  const save = async (buffer: Buffer, storageKey: string): Promise<void> => {
    const encrypted = encryptBuffer(buffer, config.encryptionKey);
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: storageKey,
        Body: encrypted
      })
    );
  };

  const read = async (storageKey: string): Promise<Buffer> => {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: storageKey
      })
    );

    if (!response.Body) {
      throw new Error("Empty object body.");
    }

    const body = await streamToBuffer(response.Body as Readable);
    return decryptBuffer(body, config.encryptionKey);
  };

  const remove = async (storageKey: string): Promise<void> => {
    await client.send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: storageKey
      })
    );
  };

  return { save, read, remove, resolvePath };
};
