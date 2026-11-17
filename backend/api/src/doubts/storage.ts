import { randomUUID } from 'node:crypto';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { AppConfig } from '../config/env';
import type { PrivateObjectStorage, UploadObject } from './types';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export class S3PrivateObjectStorage implements PrivateObjectStorage {
  private readonly client: S3Client;
  private readonly presignClient: S3Client;
  private readonly bucket: string;
  private readonly publicEndpoint: string;
  private readonly region: string;
  private readonly accessKey: string;
  private readonly secretKey: string;

  constructor(config: AppConfig) {
    this.region = config.s3Region;
    this.accessKey = config.s3AccessKey;
    this.secretKey = config.s3SecretKey;
    this.publicEndpoint = config.s3PublicEndpoint;
    this.client = this.createClient(config.s3Endpoint);
    this.presignClient = this.createClient(this.publicEndpoint);
    this.bucket = config.s3Bucket;
  }

  async presignPut(userId: string, contentType: string, contentLength: number, publicEndpoint?: string) {
    if (!ALLOWED_TYPES.has(contentType) || contentLength <= 0 || contentLength > MAX_IMAGE_BYTES) {
      throw new Error('Unsupported image upload.');
    }
    const imageKey = `${userId}/${randomUUID()}`;
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: imageKey, ContentType: contentType, ContentLength: contentLength });
    const expiresIn = 300;
    const signingClient = publicEndpoint && publicEndpoint !== this.publicEndpoint
      ? this.createClient(publicEndpoint)
      : this.presignClient;
    let uploadUrl: string;
    try {
      uploadUrl = await getSignedUrl(signingClient, command, { expiresIn });
    } finally {
      if (signingClient !== this.presignClient) signingClient.destroy();
    }
    return { imageKey, uploadUrl, expiresIn };
  }

  async getImage(userId: string, imageKey: string): Promise<UploadObject> {
    if (!imageKey.startsWith(`${userId}/`) || imageKey.includes('..')) throw new Error('Invalid image key.');
    const head = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: imageKey }));
    const contentType = head.ContentType ?? '';
    const contentLength = head.ContentLength ?? 0;
    if (!ALLOWED_TYPES.has(contentType) || contentLength <= 0 || contentLength > MAX_IMAGE_BYTES) {
      throw new Error('Uploaded image is not an accepted type or size.');
    }
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: imageKey }));
    if (!result.Body) throw new Error('Uploaded image could not be read.');
    const bytes = Buffer.from(await result.Body.transformToByteArray());
    if (bytes.length > MAX_IMAGE_BYTES) throw new Error('Uploaded image exceeds the size limit.');
    if (!matchesImageSignature(bytes, contentType)) throw new Error('Uploaded content does not match its image type.');
    return { bytes, contentType, contentLength: bytes.length };
  }

  async deleteUserObjects(userId: string): Promise<void> {
    const prefix = `${userId}/`;
    let continuationToken: string | undefined;
    do {
      const page = await this.client.send(new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }));
      const objects = (page.Contents ?? [])
        .map((object) => object.Key)
        .filter((key): key is string => Boolean(key));
      if (objects.length > 0) {
        const deleted = await this.client.send(new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: objects.map((Key) => ({ Key })), Quiet: true },
        }));
        if (deleted.Errors?.length) {
          throw new Error('One or more private upload objects could not be deleted.');
        }
      }
      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuationToken);
  }

  private createClient(endpoint: string): S3Client {
    return new S3Client({
      region: this.region,
      endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId: this.accessKey, secretAccessKey: this.secretKey },
    });
  }
}

function matchesImageSignature(bytes: Buffer, contentType: string): boolean {
  if (contentType === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (contentType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
}
