import express from "express";
import { protect, requireAdmin } from "../middleware/auth.middleware";
import upload from "../config/multer";
import {
  createTopupRequest,
  getUserTopupRequests,
  getWalletBalance,
  getWalletTransactions,
  getAllTopupRequests,
  approveTopupRequest,
  rejectTopupRequest,
} from "../controllers/wallet.controller";

const router = express.Router();

// User routes
router.post("/topup-requests", protect, upload.single("receipt"), createTopupRequest);
router.get("/topup-requests/me", protect, getUserTopupRequests);
router.get("/balance", protect, getWalletBalance);
router.get("/transactions/me", protect, getWalletTransactions);

// Admin routes
router.get("/admin/topup-requests", protect, requireAdmin, getAllTopupRequests);
router.patch("/admin/topup-requests/:id/approve", protect, requireAdmin, approveTopupRequest);
router.patch("/admin/topup-requests/:id/reject", protect, requireAdmin, rejectTopupRequest);

export default router;
