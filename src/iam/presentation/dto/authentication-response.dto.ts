export interface TokenPairDto {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
}

// Simple user response for authentication (matches what auth service returns)
export interface AuthUserResponseDto {
  id: string;
  email: string;
  phoneNumber: string;
  name?: string;
  roles: string[];
  approvalStatus: string; // String from toString() method
  hasOnboarded: boolean;
}

export interface AuthenticationResponseDto {
  success: boolean;
  user?: AuthUserResponseDto;
  tokens?: TokenPairDto;
  message: string;
}

export interface OtpGenerationResponseDto {
  success: boolean;
  message: string;
  expiresAt: Date;
  phoneNumber: string;
}

export interface SessionValidationResponseDto {
  isValid: boolean;
  userId?: string;
  roles?: string[];
  error?: string;
}

export interface OtpStatusResponseDto {
  hasValidOtp: boolean;
  expiresAt?: Date;
  remainingAttempts?: number;
}

export interface RegistrationResponseDto {
  success: boolean;
  user: AuthUserResponseDto;
  tokens: TokenPairDto;
  message: string;
}
