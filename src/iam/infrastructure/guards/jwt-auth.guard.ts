import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { UserRepository } from "../../domain/repositories/user.repository";
import { JwtTokenService } from "../../domain/services/jwt-token.service";
import { AuthenticatedRequest } from "../infrastructure.interface";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtTokenService,
    @Inject("UserRepository") private readonly userRepository: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // Extract JWT token from Authorization header
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Access token required");
    }

    const token = this.jwtService.extractTokenFromBearer(authHeader);

    try {
      // Validate token and extract payload
      const validationResult = this.jwtService.validateAccessToken(token);

      if (!validationResult.isValid || !validationResult.payload?.userId) {
        throw new UnauthorizedException("Invalid or expired token");
      }

      const userId = validationResult.payload.userId;

      const user = await this.userRepository.findById(userId);

      if (!user) {
        throw new UnauthorizedException("User not found");
      }

      // Attach user to request for use in application layer
      request.user = user;
      request.userId = userId;

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("Invalid token");
    }
  }
}
