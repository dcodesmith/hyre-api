import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { UserRepository } from "../../domain/repositories/user.repository";
import { JwtTokenService } from "../../domain/services/jwt-token.service";
import { AuthenticatedRequest } from "../infrastructure.interface";

/**
 * Optional JWT Authentication Guard
 *
 * Unlike JwtAuthGuard, this guard:
 * - Allows requests without authentication (guest users)
 * - Sets req.user if valid JWT is provided
 * - Never throws exceptions - always returns true
 *
 * Usage: For endpoints that support both authenticated and guest users (e.g., booking creation)
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtTokenService,
    @Inject("UserRepository") private readonly userRepository: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // Extract JWT token from Authorization header
    const authHeader = request.headers.authorization;

    // If no auth header, allow request to proceed as guest user
    if (!authHeader?.startsWith("Bearer ")) {
      // Explicitly set user as undefined for guest users
      request.user = undefined;
      request.userId = undefined;
      return true;
    }

    try {
      const token = this.jwtService.extractTokenFromBearer(authHeader);

      // Validate token and extract payload
      const validationResult = this.jwtService.validateAccessToken(token);

      if (!validationResult.isValid || !validationResult.payload?.userId) {
        // Invalid token - proceed as guest user
        request.user = undefined;
        request.userId = undefined;
        return true;
      }

      const userId = validationResult.payload.userId;
      const user = await this.userRepository.findById(userId);

      if (!user) {
        // User not found - proceed as guest user
        request.user = undefined;
        request.userId = undefined;
        return true;
      }

      // Valid authenticated user - attach to request
      request.user = user;
      request.userId = userId;
      return true;
    } catch (_error) {
      // Any error in token processing - proceed as guest user
      request.user = undefined;
      request.userId = undefined;
      return true;
    }
  }
}
