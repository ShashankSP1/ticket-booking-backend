import { Request, Response } from "express";
import Booking from "../shared/models/booking.model";
import Event from "../shared/models/event.model";
import { AuthenticatedRequest } from "../types/auth.types";

// POST /api/bookings — Create a booking (User)
export const createBooking = async (
	req: AuthenticatedRequest,
	res: Response
): Promise<void> => {
	try {
		const {
			eventId,
			eventName,
			eventDate,
			eventTime,
			userEmail,
			userName,
			tickets,
			totalAmount,
		} = req.body;

		if (
			!eventId ||
			!eventName ||
			!eventDate ||
			!eventTime ||
			!userEmail ||
			!userName ||
			!tickets ||
			!totalAmount
		) {
			res.status(400).json({ message: "All booking fields are required" });
			return;
		}

		if (Number(tickets) < 1) {
			res.status(400).json({ message: "Tickets must be at least 1" });
			return;
		}

		// Decrement available tickets on the Event document if ObjectId is valid
		if (String(eventId).length === 24) {
			await Event.findByIdAndUpdate(eventId, {
				$inc: { ticketsSold: Number(tickets) },
			}).catch(() => null);
		}

		const booking = await Booking.create({
			eventId,
			eventName,
			eventDate,
			eventTime,
			userEmail,
			userName,
			tickets: Number(tickets),
			totalAmount: Number(totalAmount),
			status: "confirmed",
			createdAt: new Date(),
		});

		res.status(201).json(booking);
	} catch (error) {
		res.status(500).json({ message: "Failed to create booking", error });
	}
};

// GET /api/bookings — All bookings (Admin)
export const getAllBookings = async (
	_req: Request,
	res: Response
): Promise<void> => {
	try {
		const bookings = await Booking.find().sort({ createdAt: -1 });
		res.status(200).json({ bookings });
	} catch (error) {
		res.status(500).json({ message: "Server error", error });
	}
};

// GET /api/bookings/user/:email — Booking history for a specific user
export const getBookingsByUser = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const rawEmail = req.params.email;
		const email = Array.isArray(rawEmail) ? rawEmail[0] : rawEmail;

		if (!email) {
			res.status(400).json({ message: "Email is required" });
			return;
		}

		const bookings = await Booking.find({ userEmail: decodeURIComponent(email) }).sort({
			createdAt: -1,
		});

		res.status(200).json({ bookings });
	} catch (error) {
		res.status(500).json({ message: "Server error", error });
	}
};

// GET /api/bookings/my-bookings — Booking history for logged-in user (token-based)
export const getUserBookings = async (
	req: AuthenticatedRequest,
	res: Response
): Promise<void> => {
	try {
		if (!req.user?.id) {
			res.status(401).json({ message: "Not authorized" });
			return;
		}

		const User = (await import("../shared/models/user.model")).default;
		const user = await User.findById(req.user.id).select("email").lean() as { email: string } | null;

		if (!user) {
			res.status(404).json({ message: "User not found" });
			return;
		}

		const bookings = await Booking.find({ userEmail: user.email }).sort({ createdAt: -1 });
		res.status(200).json({ bookings });
	} catch (error) {
		res.status(500).json({ message: "Server error", error });
	}
};

// PUT /api/bookings/:id/cancel — Cancel a booking
export const cancelBooking = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const rawId = req.params.id;
		const id = Array.isArray(rawId) ? rawId[0] : rawId;

		const booking = await Booking.findById(id);
		if (!booking) {
			res.status(404).json({ message: "Booking not found" });
			return;
		}

		if (booking.status === "cancelled") {
			res.status(400).json({ message: "Booking is already cancelled" });
			return;
		}

		booking.status = "cancelled";
		await booking.save();

		if (String(booking.eventId).length === 24) {
			await Event.findByIdAndUpdate(booking.eventId, {
				$inc: { ticketsSold: -booking.tickets },
			}).catch(() => null);
		}

		res.status(200).json({ message: "Booking cancelled successfully", booking });
	} catch (error) {
		res.status(500).json({ message: "Server error", error });
	}
};
