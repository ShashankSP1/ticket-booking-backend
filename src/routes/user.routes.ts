import { Router } from "express";
import { registerUser, loginUserOnly } from "../controllers/auth.controller";

const router = Router();

router.post("/signup", registerUser);
router.post("/login", loginUserOnly);

export default router;
