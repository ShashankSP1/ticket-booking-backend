import { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import { AuthenticatedRequest } from "../types/auth.types";

export const protect = (
	req: AuthenticatedRequest,
	res: Response,
	next: NextFunction
): void => {
	const authHeader = req.headers.authorization;

	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		res.status(401).json({ message: "Not authorized, token missing" });
		return;
	}

	const token = authHeader.substring(7);
	if (!token) {
		res.status(401).json({ message: "Not authorized, token missing" });
		return;
	}

	const secret = process.env.JWT_SECRET;

	if (!secret) {
		res.status(500).json({ message: "JWT secret is not configured" });
		return;
	}

	try {
		const decoded = jwt.verify(token, secret);

		if (
			typeof decoded !== "object" ||
			!decoded ||
			!("id" in decoded) ||
			!("role" in decoded) ||
			typeof decoded.id !== "string" ||
			(decoded.role !== "admin" && decoded.role !== "user")
		) {
			res.status(401).json({ message: "Not authorized, invalid token payload" });
			return;
		}

		req.user = { id: decoded.id, role: decoded.role };
		next();
	} catch {
		res.status(401).json({ message: "Not authorized, invalid token" });
	}
};

export const requireAdmin = (
	req: AuthenticatedRequest,
	res: Response,
	next: NextFunction
): void => {
	if (!req.user) {
		res.status(401).json({ message: "Not authorized" });
		return;
	}

	if (req.user.role !== "admin") {
		res.status(403).json({ message: "Admin access required" });
		return;
	}

	next();
};
