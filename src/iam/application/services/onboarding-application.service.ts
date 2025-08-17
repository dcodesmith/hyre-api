import { Inject, Injectable } from "@nestjs/common";
import {
  DocumentApproval,
  DocumentType,
} from "../../../shared/domain/entities/document-approval.entity";
import { FileStorageService } from "../../../shared/domain/file-storage.interface";
import { DocumentApprovalRepository } from "../../../shared/domain/repositories/document-approval.repository";
import { DomainEventPublisher } from "../../../shared/events/domain-event-publisher";
import { LoggerService } from "../../../shared/logging/logger.service";
import { BankDetails } from "../../domain/entities/bank-details.entity";
import { User } from "../../domain/entities/user.entity";
import { BankVerificationError, OnboardingError } from "../../domain/errors/iam.errors";
import { BankDetailsRepository } from "../../domain/repositories/bank-details.repository";
import { UserRepository } from "../../domain/repositories/user.repository";
import { BankVerificationService } from "../../domain/services/bank-verification.service";
import { FleetOwnerOnboardingDto } from "../../presentation/dto/onboarding.dto";

export interface OnboardingRequest {
  userId: string;
  dto: FleetOwnerOnboardingDto;
}

export interface OnboardingResult {
  success: boolean;
  user: User;
  bankDetails?: BankDetails;
  documents: DocumentApproval[];
  message: string;
}

/**
 * Application service for fleet owner onboarding
 * Orchestrates the complete onboarding workflow including bank verification and file upload
 */
@Injectable()
export class OnboardingApplicationService {
  constructor(
    @Inject("UserRepository")
    private readonly userRepository: UserRepository,
    @Inject("BankDetailsRepository")
    private readonly bankDetailsRepository: BankDetailsRepository,
    @Inject("DocumentApprovalRepository")
    private readonly documentRepository: DocumentApprovalRepository,
    @Inject("FileStorageService")
    private readonly fileStorageService: FileStorageService,
    private readonly bankVerificationService: BankVerificationService,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly logger: LoggerService,
  ) {}

  async completeOnboarding(request: OnboardingRequest): Promise<OnboardingResult> {
    const { userId, dto } = request;

    this.logger.info("Starting fleet owner onboarding", {
      userId,
      phoneNumber: dto.phoneNumber,
      bankCode: dto.bankCode,
    });

    // Extract certificate file from DTO
    const certificateFile = {
      fileName: dto.certificateOfIncorporation[0].originalname,
      contentType: dto.certificateOfIncorporation[0].mimetype,
      buffer: dto.certificateOfIncorporation[0].buffer,
    };

    try {
      // Step 1: Validate user and onboarding status
      const user = await this.validateUserForOnboarding(userId);

      // Step 2: Verify bank account with Flutterwave
      const bankVerificationResult = await this.verifyBankAccount(
        dto.accountNumber,
        dto.bankCode,
        dto.accountName,
      );

      if (!bankVerificationResult.isValid) {
        throw new BankVerificationError(
          bankVerificationResult.errorMessage || "Bank verification failed",
        );
      }

      // Step 3: Upload certificate file to S3
      const certificateUrl = await this.uploadCertificateFile(userId, certificateFile);

      // Step 4: Execute database transaction
      const result = await this.executeOnboardingTransaction(
        user,
        dto,
        bankVerificationResult,
        certificateUrl,
      );

      // Step 5: Publish domain events
      await this.publishDomainEvents(result.user);

      this.logger.info("Fleet owner onboarding completed successfully", {
        userId,
        bankDetailsId: result.bankDetails?.getId(),
      });

      return {
        success: true,
        user: result.user,
        bankDetails: result.bankDetails,
        documents: result.documents,
        message: "Fleet owner onboarding completed successfully",
      };
    } catch (error) {
      this.logger.error("Fleet owner onboarding failed", error);

      throw error;
    }
  }

  private async validateUserForOnboarding(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new OnboardingError("User not found");
    }

    if (!user.isFleetOwner()) {
      throw new OnboardingError("Only fleet owners can complete onboarding");
    }

    if (user.hasOnboarded()) {
      throw new OnboardingError("User has already completed onboarding");
    }

    if (!user.isApproved()) {
      throw new OnboardingError("User must be approved before onboarding");
    }

    return user;
  }

  private async verifyBankAccount(
    accountNumber: string,
    bankCode: string,
    expectedAccountName: string,
  ) {
    this.logger.info("Verifying bank account", {
      accountNumber: accountNumber.slice(-4),
      bankCode,
    });

    return await this.bankVerificationService.verifyBankAccount(
      accountNumber,
      bankCode,
      expectedAccountName,
    );
  }

  private async uploadCertificateFile(
    userId: string,
    file: { fileName: string; contentType: string; buffer: Buffer },
  ): Promise<string> {
    this.logger.info("Uploading certificate file", {
      userId,
      fileName: file.fileName,
      contentType: file.contentType,
      fileSize: file.buffer.length,
    });

    // Generate safe filename
    const timestamp = Date.now();
    const safeFileName = file.fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const _key = `${userId}/certificate-${timestamp}-${safeFileName}`;

    const uploadResult = await this.fileStorageService.uploadFile({
      fileName: file.fileName,
      contentType: file.contentType,
      buffer: file.buffer,
      folder: `onboarding/${userId}`,
    });

    if (!uploadResult.success) {
      throw new OnboardingError(
        `Certificate upload failed: ${uploadResult.errorMessage || "Unknown error"}`,
      );
    }

    if (!uploadResult.url) {
      throw new OnboardingError("Certificate upload succeeded but no URL returned");
    }

    return uploadResult.url;
  }

  private async executeOnboardingTransaction(
    user: User,
    dto: FleetOwnerOnboardingDto,
    bankVerificationResult: any,
    certificateUrl: string,
  ): Promise<{
    user: User;
    bankDetails: BankDetails;
    documents: DocumentApproval[];
  }> {
    this.logger.info("Executing onboarding database transaction", {
      userId: user.getId(),
    });

    // Get bank info
    const bankInfo = this.bankVerificationService.getBankByCode(dto.bankCode);
    if (!bankInfo) {
      throw new OnboardingError(`Invalid bank code: ${dto.bankCode}`);
    }

    // Create bank details
    const bankDetails = BankDetails.create(
      user.getId(),
      bankInfo.name,
      dto.bankCode,
      dto.accountNumber,
      bankVerificationResult.accountName,
      true, // Mark as verified since Flutterwave verification passed
      bankVerificationResult.verificationData,
    );

    // Save bank details
    const savedBankDetails = await this.bankDetailsRepository.save(bankDetails);

    // Update user profile
    user.updateProfile(dto.name, dto.address);
    user.linkBankDetails(savedBankDetails.getId());
    user.completeOnboarding();

    // Save updated user
    const updatedUser = await this.userRepository.save(user);

    // Create document approval for certificate
    const certificateDocument = DocumentApproval.create(
      DocumentType.CERTIFICATE_OF_INCORPORATION,
      certificateUrl,
      user.getId(),
    );

    const savedDocument = await this.documentRepository.save(certificateDocument);

    return {
      user: updatedUser,
      bankDetails: savedBankDetails,
      documents: [savedDocument],
    };
  }

  private async publishDomainEvents(user: User): Promise<void> {
    await this.domainEventPublisher.publish(user);
  }
}
