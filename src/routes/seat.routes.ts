import { Router } from "express";
import {
  getSeatsByEvent,
  getSeatStats,
  bulkCreateSeats,
  reserveSeats,
} from "../controllers/seat.controller";
import { protect, requireAdmin } from "../middleware/auth.middleware";

const router = Router({ mergeParams: true });

// Public
router.get("/", getSeatsByEvent);
router.get("/stats", getSeatStats);

// Admin
router.post("/bulk", protect, requireAdmin, bulkCreateSeats);

// User
router.post("/reserve", protect, reserveSeats);

export default router;
