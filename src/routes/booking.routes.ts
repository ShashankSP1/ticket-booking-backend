import { Router } from "express";
import {
	createBooking,
	getAllBookings,
	getBookingsByUser,
	getUserBookings,
	cancelBooking,
} from "../controllers/booking.controller";
import { protect, requireAdmin } from "../middleware/auth.middleware";
// Note: getBookingById, getEventBookings, confirmBooking removed — replaced by flat schema endpoints

const router = Router();

// User routes
router.post("/", protect, createBooking);                        // Create booking
router.get("/my-bookings", protect, getUserBookings);            // Token-based history
router.get("/user/:email", protect, getBookingsByUser);          // History by email
router.put("/:id/cancel", protect, cancelBooking);               // Cancel a booking

// Admin routes
router.get("/", protect, requireAdmin, getAllBookings);           // All bookings table

export default router;
