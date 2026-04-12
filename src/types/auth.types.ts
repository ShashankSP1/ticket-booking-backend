import { Request } from "express";

export interface JwtPayload {
  id: string;
  role: "user" | "admin";
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}
