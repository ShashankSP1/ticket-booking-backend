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

		if (typeof decoded !== "object" || !decoded || !("id" in decoded)) {
			res.status(401).json({ message: "Not authorized, invalid token payload" });
			return;
		}

		req.user = { id: decoded.id };
		next();
	} catch {
		res.status(401).json({ message: "Not authorized, invalid token" });
	}
};
