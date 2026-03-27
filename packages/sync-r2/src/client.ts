import { S3Client } from '@aws-sdk/client-s3';
import type { SyncSettings } from '@timetracker/core';

export function resolveR2Endpoint(accountId: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

export function createR2Client(settings: SyncSettings): S3Client {
  return new S3Client({
    region: settings.region,
    endpoint: resolveR2Endpoint(settings.accountId),
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
  });
}
