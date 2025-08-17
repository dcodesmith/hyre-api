export interface FileUploadRequest {
  readonly fileName: string;
  readonly contentType: string;
  readonly buffer: Buffer;
  readonly folder?: string;
}

export interface FileUploadResult {
  readonly success: boolean;
  readonly url?: string;
  readonly key?: string;
  readonly errorMessage?: string;
}

export interface FileDeletionRequest {
  readonly key: string;
}

export interface FileDeletionResult {
  readonly success: boolean;
  readonly errorMessage?: string;
}

/**
 * Anti-corruption layer interface for file storage operations
 * This allows the Fleet domain to upload files without depending on specific storage providers
 */
export interface FileStorageService {
  uploadFile(request: FileUploadRequest): Promise<FileUploadResult>;
  deleteFile(request: FileDeletionRequest): Promise<FileDeletionResult>;
  generatePresignedUrl?(key: string, expiresIn?: number): Promise<string>;
}
