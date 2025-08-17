import { Request } from "express";
import { User } from "../domain/entities/user.entity";

export interface AuthenticatedRequest extends Request {
  user: User;
  userId: string;
}
