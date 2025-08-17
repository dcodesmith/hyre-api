export interface AwsConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucketName: string;
}

export interface S3UploadOptions {
  key: string;
  body: Buffer;
  contentType: string;
  bucket?: string;
}

export interface S3UploadResult {
  key: string;
  url: string;
  etag?: string;
}

export interface S3DeleteOptions {
  key: string;
  bucket?: string;
}

export interface S3DeleteResult {
  deleted: boolean;
}

export interface S3PresignedUrlOptions {
  key: string;
  expiresIn?: number;
  bucket?: string;
}

export class S3Error extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly statusCode?: number,
    public readonly operation?: string,
  ) {
    super(message);
    this.name = "S3Error";
  }
}
