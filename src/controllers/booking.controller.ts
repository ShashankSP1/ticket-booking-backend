import { Request, Response } from "express";
import mongoose from "mongoose";
import Booking from "../shared/models/booking.model";
import Event from "../shared/models/event.model";
import { AuthenticatedRequest } from "../types/auth.types";

// Generate unique booking reference
const generateBookingRef = (): string => {
	return `BK${Date.now()}${Math.random().toString(36).substring(7).toUpperCase()}`;
};

const getSingleParamValue = (
	value: string | string[] | undefined
): string | undefined => {
	if (Array.isArray(value)) {
		return value[0];
	}

	return value;
};

// Create booking (user)
export const createBooking = async (
	req: AuthenticatedRequest,
	res: Response
): Promise<void> => {
	try {
		const userId = req.user?.id;
		if (!userId) {
			res.status(401).json({ message: "Not authorized" });
			return;
		}

		if (!mongoose.Types.ObjectId.isValid(userId)) {
			res.status(401).json({ message: "Invalid user token" });
			return;
		}

		const userObjectId = new mongoose.Types.ObjectId(userId);

		const { eventId, numberOfTickets } = req.body;

		if (!eventId || !numberOfTickets) {
			res.status(400).json({
				message: "Event ID and number of tickets are required",
			});
			return;
		}

		if (numberOfTickets < 1) {
			res.status(400).json({ message: "Number of tickets must be at least 1" });
			return;
		}

		if (!mongoose.Types.ObjectId.isValid(String(eventId))) {
			res.status(400).json({ message: "Invalid event ID" });
			return;
		}

		const eventObjectId = new mongoose.Types.ObjectId(String(eventId));

		const event = await Event.findById(eventObjectId);
		if (!event) {
			res.status(404).json({ message: "Event not found" });
			return;
		}

		const availableTickets = event.capacity - event.ticketsSold;
		if (numberOfTickets > availableTickets) {
			res.status(400).json({
				message: `Only ${availableTickets} tickets available`,
			});
			return;
		}

		const totalPrice = event.price * numberOfTickets;
		const bookingRef = generateBookingRef();

		const booking = await Booking.create({
			eventId: eventObjectId,
			userId: userObjectId,
			numberOfTickets,
			totalPrice,
			bookingReference: bookingRef,
		});

		// Update tickets sold
		await Event.findByIdAndUpdate(eventObjectId, {
			$inc: { ticketsSold: numberOfTickets },
		});

		res.status(201).json({
			message: "Booking created successfully",
			booking,
		});
	} catch (error) {
		res.status(500).json({ message: "Server error", error });
	}
};

// Get user bookings
export const getUserBookings = async (
	req: AuthenticatedRequest,
	res: Response
): Promise<void> => {
	try {
		const userId = req.user?.id;
		if (!userId) {
			res.status(401).json({ message: "Not authorized" });
			return;
		}

		if (!mongoose.Types.ObjectId.isValid(userId)) {
			res.status(401).json({ message: "Invalid user token" });
			return;
		}

		const userObjectId = new mongoose.Types.ObjectId(userId);

		const bookings = await Booking.find({ userId: userObjectId })
			.populate("eventId", "name date venue price")
			.sort({ createdAt: -1 });

		res.status(200).json({
			message: "User bookings retrieved successfully",
			count: bookings.length,
			bookings,
		});
	} catch (error) {
		res.status(500).json({ message: "Server error", error });
	}
};

// Get booking by ID
export const getBookingById = async (
	req: AuthenticatedRequest,
	res: Response
): Promise<void> => {
	try {
		const userId = req.user?.id;
		if (!userId) {
			res.status(401).json({ message: "Not authorized" });
			return;
		}

		const bookingId = getSingleParamValue(req.params.bookingId);
		if (!bookingId) {
			res.status(400).json({ message: "Booking ID is required" });
			return;
		}

		const booking = await Booking.findById(bookingId).populate(
			"eventId userId",
			"name date venue price email"
		);

		if (!booking) {
			res.status(404).json({ message: "Booking not found" });
			return;
		}

		if (String(booking.userId._id) !== userId) {
			res.status(403).json({ message: "Not authorized to view this booking" });
			return;
		}

		res.status(200).json({
			message: "Booking retrieved successfully",
			booking,
		});
	} catch (error) {
		res.status(500).json({ message: "Server error", error });
	}
};

// Cancel booking
export const cancelBooking = async (
	req: AuthenticatedRequest,
	res: Response
): Promise<void> => {
	try {
		const userId = req.user?.id;
		if (!userId) {
			res.status(401).json({ message: "Not authorized" });
			return;
		}

		const bookingId = getSingleParamValue(req.params.bookingId);
		if (!bookingId) {
			res.status(400).json({ message: "Booking ID is required" });
			return;
		}

		const booking = await Booking.findById(bookingId);
		if (!booking) {
			res.status(404).json({ message: "Booking not found" });
			return;
		}

		if (String(booking.userId) !== userId) {
			res.status(403).json({ message: "Not authorized to cancel this booking" });
			return;
		}

		if (booking.status === "cancelled") {
			res.status(400).json({ message: "Booking is already cancelled" });
			return;
		}

		// Update booking status
		booking.status = "cancelled";
		await booking.save();

		// Free up tickets
		await Event.findByIdAndUpdate(booking.eventId, {
			$inc: { ticketsSold: -booking.numberOfTickets },
		});

		res.status(200).json({
			message: "Booking cancelled successfully",
			booking,
		});
	} catch (error) {
		res.status(500).json({ message: "Server error", error });
	}
};

// Get all bookings for an event (admin only)
export const getEventBookings = async (
	req: AuthenticatedRequest,
	res: Response
): Promise<void> => {
	try {
		const userId = req.user?.id;
		if (!userId) {
			res.status(401).json({ message: "Not authorized" });
			return;
		}

		const eventId = getSingleParamValue(req.params.eventId);
		if (!eventId) {
			res.status(400).json({ message: "Event ID is required" });
			return;
		}

		if (!mongoose.Types.ObjectId.isValid(eventId)) {
			res.status(400).json({ message: "Invalid event ID" });
			return;
		}

		const eventObjectId = new mongoose.Types.ObjectId(eventId);

		const event = await Event.findById(eventObjectId);
		if (!event) {
			res.status(404).json({ message: "Event not found" });
			return;
		}

		if (String(event.createdBy) !== userId) {
			res.status(403).json({ message: "Not authorized to view bookings for this event" });
			return;
		}

		const bookings = await Booking.find({ eventId: eventObjectId }).populate(
			"userId",
			"name email"
		);

		res.status(200).json({
			message: "Event bookings retrieved successfully",
			count: bookings.length,
			bookings,
		});
	} catch (error) {
		res.status(500).json({ message: "Server error", error });
	}
};

// Confirm booking (admin only)
export const confirmBooking = async (
	req: AuthenticatedRequest,
	res: Response
): Promise<void> => {
	try {
		const bookingId = getSingleParamValue(req.params.bookingId);
		if (!bookingId) {
			res.status(400).json({ message: "Booking ID is required" });
			return;
		}

		const booking = await Booking.findById(bookingId);
		if (!booking) {
			res.status(404).json({ message: "Booking not found" });
			return;
		}

		booking.status = "confirmed";
		await booking.save();

		res.status(200).json({
			message: "Booking confirmed successfully",
			booking,
		});
	} catch (error) {
		res.status(500).json({ message: "Server error", error });
	}
};
