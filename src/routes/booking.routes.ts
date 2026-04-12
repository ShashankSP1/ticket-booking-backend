import { Router } from "express";
import {
	createBooking,
	getUserBookings,
	getBookingById,
	cancelBooking,
	getEventBookings,
	confirmBooking,
} from "../controllers/booking.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

// User routes
router.post("/", protect, createBooking);
router.get("/my-bookings", protect, getUserBookings);
router.get("/:bookingId", protect, getBookingById);
router.put("/:bookingId/cancel", protect, cancelBooking);

// Admin routes
router.get("/event/:eventId", protect, getEventBookings);
router.put("/:bookingId/confirm", protect, confirmBooking);

export default router;
