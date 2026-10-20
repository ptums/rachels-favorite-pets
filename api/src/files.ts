import type { Readable } from 'node:stream';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { config } from './config.ts';

// Path-style URLs when pointed at a local emulator (no per-bucket DNS on localhost).
const s3 = new S3Client({
  region: config.aws.region,
  endpoint: config.aws.s3Endpoint,
  forcePathStyle: Boolean(config.aws.s3Endpoint),
});
const Bucket = config.photosBucket;

export async function ensureBucket(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket }));
  } catch (error) {
    if (!(error instanceof NotFound)) throw error;
    await s3.send(new CreateBucketCommand({ Bucket }));
  }
}

export async function putFile(key: string, body: Buffer, contentType: string): Promise<void> {
  await s3.send(new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: contentType }));
}

export async function getFile(key: string): Promise<Readable> {
  const result = await s3.send(new GetObjectCommand({ Bucket, Key: key }));
  return result.Body as Readable;
}

// S3 deletes are idempotent: no error if the object is already gone.
export async function deleteFile(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket, Key: key }));
}
