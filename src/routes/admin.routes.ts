import { Router } from "express";
import { registerAdmin, loginAdmin } from "../controllers/auth.controller";

const router = Router();

router.post("/signup", registerAdmin);
router.post("/register", registerAdmin);
router.post("/login", loginAdmin);
router.post("/signin", loginAdmin);

export default router;
