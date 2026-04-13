import { Router } from "express";
import {
	createBooking,
	getAllBookings,
	getBookingsByUser,
	getUserBookings,
	cancelBooking,
	confirmBooking,
	adminCancelBooking,
} from "../controllers/booking.controller";
import { protect, requireAdmin } from "../middleware/auth.middleware";

const router = Router();

// User routes
router.post("/confirm", protect, confirmBooking);                // Atomic seat-based confirm
router.post("/", protect, createBooking);                        // Legacy create booking
router.get("/my-bookings", protect, getUserBookings);            // Token-based history
router.get("/user/:email", protect, getBookingsByUser);          // History by email
router.put("/:id/cancel", protect, cancelBooking);               // Cancel a booking (with refund)

// Admin routes
router.get("/", protect, requireAdmin, getAllBookings);           // All bookings table
router.post("/:id/cancel-refund", protect, requireAdmin, adminCancelBooking); // Force cancel + refund

export default router;
