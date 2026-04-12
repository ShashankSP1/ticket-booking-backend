import { Request, Response } from "express";
import Booking from "../shared/models/booking.model";
import Event from "../shared/models/event.model";
import { AuthenticatedRequest } from "../types/auth.types";
import User from "../shared/models/user.model";

// POST /api/bookings — Create a booking (User)
export const createBooking = async (
	req: AuthenticatedRequest,
	res: Response
): Promise<void> => {
	try {
		if (!req.user?.id) {
			res.status(401).json({ message: "Not authorized" });
			return;
		}

		const loggedInUser = (await User.findById(req.user.id)
			.select("name email role")
			.lean()) as { name: string; email: string; role: "user" | "admin" } | null;

		if (!loggedInUser) {
			res.status(404).json({ message: "User not found" });
			return;
		}

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

		if (!eventId || !tickets) {
			res.status(400).json({ message: "eventId and tickets are required" });
			return;
		}

		const ticketCount = Number(tickets);
		if (!Number.isFinite(ticketCount) || ticketCount < 1) {
			res.status(400).json({ message: "Tickets must be at least 1" });
			return;
		}

		let eventDoc: {
			name: string;
			date: Date;
			time?: string;
			price: number;
			capacity: number;
			ticketsSold: number;
		} | null = null;

		if (String(eventId).length === 24) {
			eventDoc = (await Event.findById(eventId)
				.select("name date time price capacity ticketsSold")
				.lean()) as {
				name: string;
				date: Date;
				time?: string;
				price: number;
				capacity: number;
				ticketsSold: number;
			} | null;

			if (eventDoc) {
				const available = eventDoc.capacity - eventDoc.ticketsSold;
				if (available < ticketCount) {
					res.status(400).json({
						message: `Only ${available} tickets available`,
					});
					return;
				}

				await Event.findByIdAndUpdate(eventId, {
					$inc: { ticketsSold: ticketCount },
				});
			}
		}

		const resolvedUserEmail = (
			loggedInUser?.role === "user" ? loggedInUser.email : userEmail
		)?.toLowerCase().trim();
		const resolvedUserName =
			loggedInUser?.role === "user" ? loggedInUser.name : userName;

		if (!resolvedUserEmail || !resolvedUserName) {
			res.status(400).json({ message: "User name and email are required" });
			return;
		}

		const resolvedEventName = eventName ?? eventDoc?.name;
		const resolvedEventDate =
			eventDate ?? (eventDoc?.date ? new Date(eventDoc.date).toISOString().slice(0, 10) : undefined);
		const resolvedEventTime = eventTime ?? eventDoc?.time ?? "TBD";
		const resolvedTotalAmount =
			totalAmount !== undefined ? Number(totalAmount) : eventDoc ? eventDoc.price * ticketCount : undefined;

		if (!resolvedEventName || !resolvedEventDate || resolvedTotalAmount === undefined) {
			res.status(400).json({
				message:
					"Missing event details. Send eventName, eventDate, totalAmount or provide a valid eventId.",
			});
			return;
		}

		const booking = await Booking.create({
			eventId,
			eventName: resolvedEventName,
			eventDate: resolvedEventDate,
			eventTime: resolvedEventTime,
			userEmail: resolvedUserEmail,
			userName: resolvedUserName,
			tickets: ticketCount,
			totalAmount: resolvedTotalAmount,
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
	req: AuthenticatedRequest,
	res: Response
): Promise<void> => {
	try {
		const rawEmail = req.params.email;
		let email = Array.isArray(rawEmail) ? rawEmail[0] : rawEmail;

		if (req.user?.role === "user" && req.user.id) {
			const currentUser = (await User.findById(req.user.id)
				.select("email")
				.lean()) as { email: string } | null;

			email = currentUser?.email;
		}

		if (!email) {
			res.status(400).json({ message: "Email is required" });
			return;
		}

		const bookings = await Booking.find({
			userEmail: decodeURIComponent(email).toLowerCase().trim(),
		}).sort({
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

		const user = (await User.findById(req.user.id)
			.select("email")
			.lean()) as { email: string } | null;

		if (!user) {
			res.status(404).json({ message: "User not found" });
			return;
		}

		const bookings = await Booking.find({
			userEmail: user.email.toLowerCase().trim(),
		}).sort({ createdAt: -1 });
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
