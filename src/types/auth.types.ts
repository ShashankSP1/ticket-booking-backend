import { Request } from "express";

export interface JwtPayload {
  id: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}
