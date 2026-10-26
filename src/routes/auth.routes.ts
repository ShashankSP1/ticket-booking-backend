import { Router } from "express";
import {
	loginAdmin,
	loginUser,
	registerAdmin,
	registerUser,
	getMe,
} from "../controllers/auth.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.post("/user/register", registerUser);
router.post("/user/login", loginUser);

router.post("/admin/register", registerAdmin);
router.post("/admin/login", loginAdmin);

router.get("/me", protect, getMe);

export default router;
