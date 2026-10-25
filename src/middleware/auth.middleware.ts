import { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import { AuthenticatedRequest } from "../types/auth.types";

export const protect = (
	req: AuthenticatedRequest,
	res: Response,
	next: NextFunction
): void => {
	const authHeader = req.headers.authorization;

	if (!authHeader?.startsWith("Bearer ")) {
		res.status(401).json({ message: "Not authorized, token missing", code: "TOKEN_MISSING", });
		return;
	}

	const token = authHeader.substring(7).trim();
	if (!token) {
		res.status(401).json({ message: "Not authorized, token missing", code: "TOKEN_MISSING", });
		return;
	}

	const secret = process.env.JWT_SECRET;

	if (!secret) {
		res.status(500).json({ message: "JWT secret is not configured" });
		return;
	}

	try {
		const decoded = jwt.verify(token, secret, {
			algorithms: ["HS256"],
		});

		if (
			typeof decoded !== "object" ||
			decoded === null ||
			typeof decoded.id !== "string" ||
			(decoded.role !== "admin" && decoded.role !== "user")
		) {
			res.status(401).json({ message: "Not authorized, invalid token payload", code: "TOKEN_INVALID", });
			return;
		}

		req.user = { id: decoded.id, role: decoded.role };
		next();
	} catch(error: unknown) {
		if(error instanceof jwt.TokenExpiredError){
			res.status(401).json({ 
				message: "Not authorized, invalid token",
				code: "TOKEN_EXPIRED",
			 });
			 return;
		}
		if(error instanceof jwt.JsonWebTokenError || error instanceof jwt.NotBeforeError){
			res.status(401).json({
				message: "Invalid or inactive authentication token",
				code: "TOKEN_INVALID",
			});
			return;
		}

		res.status(500).json({
			message: "Authentication verification failed",
		});
	}
};

export const requireAdmin = (
	req: AuthenticatedRequest,
	res: Response,
	next: NextFunction
): void => {
	if (!req.user) {
		res.status(401).json({ message: "Not authorized", code: "TOKEN_MISSING", });
		return;
	}

	if (req.user.role !== "admin") {
		res.status(403).json({ message: "Admin access required" });
		return;
	}

	next();
};
