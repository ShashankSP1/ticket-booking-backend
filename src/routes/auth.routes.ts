import { Router } from "express";
import {
	loginAdmin,
	loginUser,
	registerAdmin,
	registerUser,
} from "../controllers/auth.controller";

const router = Router();

router.post("/user/register", registerUser);
router.post("/user/login", loginUser);
router.post("/user/signin", loginUser);

router.post("/admin/register", registerAdmin);
router.post("/admin/signup", registerAdmin);
router.post("/admin/login", loginAdmin);
router.post("/admin/signin", loginAdmin);

export default router;
