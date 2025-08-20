import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { TypedConfigService } from "../../../shared/config/typed-config.service";
import { User } from "../entities/user.entity";
import { TokenValidationError } from "../errors/iam.errors";

export interface TokenPayload {
  userId: string;
  email: string;
  phoneNumber: string;
  roles: string[];
  approvalStatus: string;
  iat: number;
  exp: number;
}

export interface GenerateTokenOptions {
  expiresIn?: string | number;
  includeRefreshToken?: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export interface TokenValidationResult {
  isValid: boolean;
  payload?: TokenPayload;
  error?: string;
  isExpired?: boolean;
}

@Injectable()
export class JwtTokenService {
  private readonly JWT_SECRET: string;
  private readonly JWT_REFRESH_SECRET: string;
  private readonly ACCESS_TOKEN_EXPIRY = "15m";
  private readonly REFRESH_TOKEN_EXPIRY = "7d";

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: TypedConfigService,
  ) {
    this.JWT_SECRET = this.configService.jwt.secret;
    this.JWT_REFRESH_SECRET = this.configService.jwt.refreshSecret;
  }

  generateTokens(user: User, options: GenerateTokenOptions = {}): TokenPair {
    const payload = this.createTokenPayload(user);

    const expiresIn = options.expiresIn || this.ACCESS_TOKEN_EXPIRY;
    const accessToken = this.jwtService.sign(payload, {
      secret: this.JWT_SECRET,
      expiresIn,
    });

    const result: TokenPair = {
      accessToken,
      expiresAt: this.calculateExpirationDate(expiresIn),
    };

    if (options.includeRefreshToken) {
      const refreshPayload = {
        userId: user.getId(),
        tokenType: "refresh",
      };

      result.refreshToken = this.jwtService.sign(refreshPayload, {
        secret: this.JWT_REFRESH_SECRET,
        expiresIn: this.REFRESH_TOKEN_EXPIRY,
      });
    }

    return result;
  }

  validateAccessToken(token: string): TokenValidationResult {
    try {
      const payload = this.jwtService.verify<TokenPayload>(token, {
        secret: this.JWT_SECRET,
      });

      return {
        isValid: true,
        payload,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        const isExpired = error.name === "TokenExpiredError";

        return {
          isValid: false,
          error: error.message,
          isExpired,
        };
      }

      return { isValid: false, error: "Unknown error" };
    }
  }

  validateRefreshToken(token: string): { isValid: boolean; userId?: string; error?: string } {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.JWT_REFRESH_SECRET,
      });

      if (payload.tokenType !== "refresh") {
        return {
          isValid: false,
          error: "Invalid token type",
        };
      }

      return {
        isValid: true,
        userId: payload.userId,
      };
    } catch (error: any) {
      return {
        isValid: false,
        error: error.message,
      };
    }
  }

  refreshAccessToken(refreshToken: string, user: User): TokenPair {
    const validation = this.validateRefreshToken(refreshToken);

    if (!validation.isValid) {
      throw new TokenValidationError(`Invalid refresh token: ${validation.error}`);
    }

    if (validation.userId !== user.getId()) {
      throw new TokenValidationError("Refresh token does not match user");
    }

    // Generate new access token
    return this.generateTokens(user, { includeRefreshToken: false });
  }

  extractTokenFromBearer(bearerToken: string): string {
    if (!bearerToken?.startsWith("Bearer ")) {
      throw new TokenValidationError("Invalid bearer token format");
    }

    return bearerToken.substring(7);
  }

  isTokenExpired(token: string): boolean {
    try {
      const decoded = this.jwtService.decode<TokenPayload>(token);
      if (!decoded?.exp) {
        return true;
      }

      return Date.now() >= decoded.exp * 1000;
    } catch {
      return true;
    }
  }

  getTokenClaims(token: string): TokenPayload | null {
    try {
      return this.jwtService.decode<TokenPayload>(token);
    } catch {
      return null;
    }
  }

  generatePasswordResetToken(userId: string): string {
    const payload = {
      userId,
      tokenType: "password-reset",
      purpose: "password-reset",
    };

    return this.jwtService.sign(payload, {
      secret: this.JWT_SECRET,
      expiresIn: "1h", // Password reset tokens expire in 1 hour
    });
  }

  validatePasswordResetToken(token: string): { isValid: boolean; userId?: string; error?: string } {
    try {
      const payload = this.jwtService.verify<{
        userId: string;
        tokenType: string;
        purpose: string;
      }>(token, {
        secret: this.JWT_SECRET,
      });

      if (payload.tokenType !== "password-reset" || payload.purpose !== "password-reset") {
        return {
          isValid: false,
          error: "Invalid token purpose",
        };
      }

      return {
        isValid: true,
        userId: payload.userId,
      };
    } catch (error: any) {
      return {
        isValid: false,
        error: error.message,
      };
    }
  }

  generateEmailVerificationToken(userId: string, email: string): string {
    const payload = {
      userId,
      email,
      tokenType: "email-verification",
      purpose: "email-verification",
    };

    return this.jwtService.sign(payload, {
      secret: this.JWT_SECRET,
      expiresIn: "24h", // Email verification tokens expire in 24 hours
    });
  }

  validateEmailVerificationToken(token: string): {
    isValid: boolean;
    userId?: string;
    email?: string;
    error?: string;
  } {
    try {
      const payload = this.jwtService.verify<{
        userId: string;
        email: string;
        tokenType: string;
        purpose: string;
      }>(token, {
        secret: this.JWT_SECRET,
      });

      if (payload.tokenType !== "email-verification" || payload.purpose !== "email-verification") {
        return {
          isValid: false,
          error: "Invalid token purpose",
        };
      }

      return {
        isValid: true,
        userId: payload.userId,
        email: payload.email,
      };
    } catch (error: any) {
      return {
        isValid: false,
        error: error.message,
      };
    }
  }

  private createTokenPayload(user: User): Omit<TokenPayload, "iat" | "exp"> {
    return {
      userId: user.getId(),
      email: user.getEmail(),
      phoneNumber: user.getPhoneNumber(),
      roles: user.getRoles().map((role) => role.toString()),
      approvalStatus: user.getApprovalStatus().toString(),
    };
  }

  private calculateExpirationDate(expiresIn: string | number): number {
    if (typeof expiresIn === "number") {
      return Date.now() + expiresIn * 1000;
    }

    // Parse string format like "15m", "1h", "7d"
    const unit = expiresIn.slice(-1);
    const value = Number.parseInt(expiresIn.slice(0, -1));

    // Fallback for invalid values
    if (!Number.isFinite(value) || value <= 0) {
      return Date.now() + 15 * 60 * 1000; // 15 minutes
    }

    let milliseconds = 0;
    switch (unit) {
      case "s":
        milliseconds = value * 1000;
        break;
      case "m":
        milliseconds = value * 60 * 1000;
        break;
      case "h":
        milliseconds = value * 60 * 60 * 1000;
        break;
      case "d":
        milliseconds = value * 24 * 60 * 60 * 1000;
        break;
      default:
        milliseconds = 15 * 60 * 1000; // Default to 15 minutes
    }

    return Date.now() + milliseconds;
  }
}
