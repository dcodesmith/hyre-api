export interface JwtPayload {
  userId: string;
  email: string;
  phoneNumber: string;
  roles: string[];
  approvalStatus: string;
  iat: number;
  exp: number;
}
