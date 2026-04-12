import { Router } from "express";
import {
	loginAdmin,
	loginUser,
	registerAdmin,
	registerUser,
} from "../controllers/auth.controller";

const router = Router();

const isAdminRole = (role: unknown): boolean =>
	typeof role === "string" && role.toLowerCase() === "admin";

router.post("/register", (req, res) => {
	if (isAdminRole(req.body?.role)) {
		return registerAdmin(req, res);
	}

	return registerUser(req, res);
});

router.post("/login", (req, res) => {
	if (isAdminRole(req.body?.role)) {
		return loginAdmin(req, res);
	}

	return loginUser(req, res);
});

router.post("/signin", (req, res) => {
	if (isAdminRole(req.body?.role)) {
		return loginAdmin(req, res);
	}

	return loginUser(req, res);
});

export default router;
