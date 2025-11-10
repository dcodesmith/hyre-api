import { Injectable } from "@nestjs/common";
import {
  FileDeletionRequest,
  FileDeletionResult,
  FileStorageService,
  FileUploadRequest,
  FileUploadResult,
} from "../../domain/file-storage.interface";
import { S3Client, S3Error } from "../external/aws";

/**
 * S3 implementation of the FileStorageService interface
 * Anti-corruption layer that isolates the domain from AWS S3 specifics
 */
@Injectable()
export class S3FileStorageAdapter implements FileStorageService {
  constructor(private readonly s3Client: S3Client) {}

  async uploadFile(request: FileUploadRequest): Promise<FileUploadResult> {
    try {
      const key = request.folder ? `${request.folder}/${request.fileName}` : request.fileName;

      const result = await this.s3Client.upload({
        key,
        body: request.buffer,
        contentType: request.contentType,
      });

      return {
        success: true,
        url: result.url,
        key: result.key,
      };
    } catch (error) {
      if (error instanceof S3Error) {
        return {
          success: false,
          errorMessage: error.message,
        };
      }

      return {
        success: false,
        errorMessage: `S3 upload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  async deleteFile(request: FileDeletionRequest): Promise<FileDeletionResult> {
    try {
      await this.s3Client.delete({
        key: request.key,
      });

      return {
        success: true,
      };
    } catch (error) {
      if (error instanceof S3Error) {
        return {
          success: false,
          errorMessage: error.message,
        };
      }

      return {
        success: false,
        errorMessage: `S3 deletion failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  async generatePresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      return await this.s3Client.generatePresignedUrl({
        key,
        expiresIn,
      });
    } catch (error) {
      if (error instanceof S3Error) {
        throw error;
      }

      throw new Error(
        `Failed to generate presigned URL: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
