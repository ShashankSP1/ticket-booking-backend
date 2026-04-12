import { Router } from "express";
import { registerUser, loginUserOnly } from "../controllers/auth.controller";

const router = Router();

router.post("/signup", registerUser);
router.post("/register", registerUser);
router.post("/login", loginUserOnly);
router.post("/signin", loginUserOnly);

export default router;
