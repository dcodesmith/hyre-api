import {
  S3Client as AwsS3Client,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable } from "@nestjs/common";
import { TypedConfigService } from "../../../config/typed-config.service";
import { LoggerService } from "../../../logging/logger.service";
import {
  AwsConfig,
  S3DeleteOptions,
  S3DeleteResult,
  S3Error,
  S3PresignedUrlOptions,
  S3UploadOptions,
  S3UploadResult,
} from "./s3.types";

@Injectable()
export class S3Client {
  private readonly config: AwsConfig;
  private readonly s3Client: AwsS3Client;

  constructor(
    private readonly configService: TypedConfigService,
    private readonly logger: LoggerService,
  ) {
    this.config = this.configService.aws;

    this.s3Client = new AwsS3Client({
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
    });
  }

  /**
   * Upload a file to S3
   */
  async upload(options: S3UploadOptions): Promise<S3UploadResult> {
    try {
      const bucket = options.bucket || this.config.bucketName;

      this.logger.log(`Uploading file to S3: ${options.key}`, "S3Client");

      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: options.key,
        Body: options.body,
        ContentType: options.contentType,
      });

      const result = await this.s3Client.send(command);
      const url = `https://${bucket}.s3.${this.config.region}.amazonaws.com/${options.key}`;

      this.logger.log(`File uploaded to S3 successfully: ${options.key}`, "S3Client");

      return {
        key: options.key,
        url,
        etag: result.ETag,
      };
    } catch (error) {
      throw this.handleError(error, `upload ${options.key}`);
    }
  }

  /**
   * Delete a file from S3
   */
  async delete(options: S3DeleteOptions): Promise<S3DeleteResult> {
    try {
      const bucket = options.bucket || this.config.bucketName;

      this.logger.log(`Deleting file from S3: ${options.key}`, "S3Client");

      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: options.key,
      });

      await this.s3Client.send(command);

      this.logger.log(`File deleted from S3 successfully: ${options.key}`, "S3Client");

      return {
        deleted: true,
      };
    } catch (error) {
      throw this.handleError(error, `delete ${options.key}`);
    }
  }

  /**
   * Generate a presigned URL for accessing a file
   */
  async generatePresignedUrl(options: S3PresignedUrlOptions): Promise<string> {
    try {
      const bucket = options.bucket || this.config.bucketName;
      const expiresIn = options.expiresIn || 3600; // 1 hour default

      this.logger.log(`Generating presigned URL for: ${options.key}`, "S3Client");

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: options.key,
      });

      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      this.logger.log(`Presigned URL generated for: ${options.key}`, "S3Client");

      return url;
    } catch (error) {
      throw this.handleError(error, `generate presigned URL for ${options.key}`);
    }
  }

  /**
   * Get the default bucket name
   */
  getDefaultBucket(): string {
    return this.config.bucketName;
  }

  /**
   * Get the AWS region
   */
  getRegion(): string {
    return this.config.region;
  }

  private handleError(error: unknown, operation: string): S3Error {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    this.logger.error(
      `S3 ${operation} failed: ${errorMessage}`,
      error instanceof Error ? error.stack : undefined,
      "S3Client",
    );

    if (error instanceof S3ServiceException) {
      return new S3Error(error.message, error.name, error.$metadata?.httpStatusCode, operation);
    }

    if (error instanceof Error) {
      return new S3Error(`S3 operation failed: ${error.message}`, "S3_ERROR", undefined, operation);
    }

    return new S3Error(
      `Unexpected S3 error during ${operation}`,
      "UNEXPECTED_ERROR",
      undefined,
      operation,
    );
  }
}
