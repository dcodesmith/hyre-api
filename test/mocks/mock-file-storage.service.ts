import {
  FileDeletionRequest,
  FileDeletionResult,
  FileStorageService,
  FileUploadRequest,
  FileUploadResult,
} from "../../src/shared/domain/file-storage.interface";

/**
 * Mock implementation of FileStorageService for testing
 * Simulates S3 upload behavior without making actual AWS calls
 */
export class MockFileStorageService implements FileStorageService {
  private uploadedFiles: Map<string, FileUploadRequest> = new Map();

  async uploadFile(request: FileUploadRequest): Promise<FileUploadResult> {
    const _timestamp = Date.now();
    const key = request.folder ? `${request.folder}/${request.fileName}` : request.fileName;

    // Store the uploaded file info for potential verification
    this.uploadedFiles.set(key, request);

    // Generate realistic-looking S3 URL
    const url = `https://mock-hyre-bucket.s3.eu-west-1.amazonaws.com/${key}`;

    return {
      success: true,
      url,
      key,
    };
  }

  async deleteFile(request: FileDeletionRequest): Promise<FileDeletionResult> {
    // Remove from our mock storage
    this.uploadedFiles.delete(request.key);

    return {
      success: true,
    };
  }

  async generatePresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const timestamp = Math.floor(Date.now() / 1000) + expiresIn;
    return `https://mock-hyre-bucket.s3.eu-west-1.amazonaws.com/${key}?X-Amz-Expires=${expiresIn}&X-Amz-Date=${timestamp}`;
  }

  // Test helper methods
  getUploadedFiles(): Map<string, FileUploadRequest> {
    return new Map(this.uploadedFiles);
  }

  getUploadedFile(key: string): FileUploadRequest | undefined {
    return this.uploadedFiles.get(key);
  }

  clearUploadedFiles(): void {
    this.uploadedFiles.clear();
  }

  getUploadCount(): number {
    return this.uploadedFiles.size;
  }
}
