import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { User } from "../../domain/entities/user.entity";
import { AuthenticatedRequest } from "../infrastructure.interface";

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): User => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.user;
});

/**
 * Optional Current User Decorator
 *
 * Returns the authenticated user or undefined if no authentication is provided.
 * Use with OptionalJwtAuthGuard for endpoints that support both authenticated and guest users.
 */
export const OptionalCurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): User | undefined => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);
