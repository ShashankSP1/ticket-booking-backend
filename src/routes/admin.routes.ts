import { Router } from "express";
import { registerAdmin, loginAdmin } from "../controllers/auth.controller";
const router = Router();

/**
 * @swagger
 * /api/admin/register:
 *   post:
 *     summary: Register a new admin
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Admin'
 *     responses:
 *       201:
 *         description: Admin registered successfully
 *       400:
 *         description: Bad request
 */
router.post("/register", registerAdmin);

/**
 * @swagger
 * /api/admin/login:
 *   post:
 *     summary: Log in an admin
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Admin logged in successfully
 */
router.post("/login", loginAdmin);

export default router;
