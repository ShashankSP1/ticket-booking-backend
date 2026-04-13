import { Request, Response } from "express";
import mongoose from "mongoose";
import Booking from "../shared/models/booking.model";
import Event from "../shared/models/event.model";
import Reservation from "../shared/models/reservation.model";
import Seat from "../shared/models/seat.model";
import Wallet from "../shared/models/wallet.model";
import WalletTransaction from "../shared/models/walletTransaction.model";
import { AuthenticatedRequest } from "../types/auth.types";
import User from "../shared/models/user.model";

const toBookingResponse = (booking: any) => ({
	id: booking._id?.toString(),
	eventId: booking.eventId,
	eventName: booking.eventName,
	eventDate: booking.eventDate,
	eventTime: booking.eventTime,
	userId: booking.userId?.toString?.() ?? booking.userId,
	userEmail: booking.userEmail,
	userName: booking.userName,
	tickets: booking.tickets,
	totalAmount: booking.totalAmount,
	seatNumbers: booking.seatNumbers ?? [],
	status: booking.status,
	createdAt: booking.createdAt,
});

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

		if (!Number.isFinite(resolvedTotalAmount) || resolvedTotalAmount <= 0) {
			res.status(400).json({ message: "totalAmount must be greater than 0" });
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

		res.status(201).json(toBookingResponse(booking));
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
		const bookings = await Booking.find().sort({ createdAt: -1 }).lean();
		res.status(200).json({ bookings: bookings.map(toBookingResponse) });
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
		})
			.sort({
			createdAt: -1,
			})
			.lean();

		res.status(200).json({ bookings: bookings.map(toBookingResponse) });
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
		})
			.sort({ createdAt: -1 })
			.lean();
		res.status(200).json({ bookings: bookings.map(toBookingResponse) });
	} catch (error) {
		res.status(500).json({ message: "Server error", error });
	}
};

// PUT /api/bookings/:id/cancel — Cancel a booking (user, with wallet refund)
export const cancelBooking = async (
	req: AuthenticatedRequest,
	res: Response
): Promise<void> => {
	const session = await mongoose.startSession();
	session.startTransaction();

	try {
		const rawId = req.params.id;
		const id = Array.isArray(rawId) ? rawId[0] : rawId;
		const userId = req.user?.id;

		if (!userId) {
			await session.abortTransaction();
			res.status(401).json({ message: "Not authorized" });
			return;
		}

		const booking = await Booking.findById(id).session(session);
		if (!booking) {
			await session.abortTransaction();
			res.status(404).json({ message: "Booking not found" });
			return;
		}

		// Users can only cancel their own bookings
		if (req.user?.role === "user" && booking.userId && String(booking.userId) !== userId) {
			await session.abortTransaction();
			res.status(403).json({ message: "Not authorized to cancel this booking" });
			return;
		}

		if (booking.status === "cancelled") {
			await session.abortTransaction();
			res.status(409).json({ message: "Booking is already cancelled" });
			return;
		}

		booking.status = "cancelled";
		await booking.save({ session });

		// Release seats back to available
		if (booking.seatNumbers && booking.seatNumbers.length > 0) {
			await Seat.updateMany(
				{ eventId: booking.eventId, seatNumber: { $in: booking.seatNumbers } },
				{ $set: { state: "available", reservedBy: null, reservedUntil: null } },
				{ session }
			);
		}

		// Decrement ticketsSold
		if (String(booking.eventId).length === 24) {
			await Event.findByIdAndUpdate(booking.eventId, {
				$inc: { ticketsSold: -booking.tickets },
			}, { session }).catch(() => null);
		}

		// Refund wallet (full refund)
		const user = await User.findById(booking.userId || userId).session(session);
		if (user) {
			let wallet = await Wallet.findOne({ userEmail: user.email.toLowerCase() }).session(session);
			if (!wallet) {
				wallet = new Wallet({
					userId: user._id,
					userEmail: user.email.toLowerCase(),
					balance: 0,
				});
			}
			wallet.balance += booking.totalAmount;
			await wallet.save({ session });

			await WalletTransaction.create(
				[{
					userId: user._id,
					userEmail: user.email.toLowerCase(),
					userName: user.name,
					type: "credit",
					amount: booking.totalAmount,
					description: `Refund for cancelled booking: ${booking.eventName}`,
					referenceType: "BOOKING_CANCEL",
					referenceId: booking._id.toString(),
				}],
				{ session }
			);
		}

		await session.commitTransaction();

		res.status(200).json({
			message: "Booking cancelled successfully",
			booking: toBookingResponse(booking),
		});
	} catch (error) {
		await session.abortTransaction();
		res.status(500).json({ message: "Server error", error });
	} finally {
		session.endSession();
	}
};

// POST /api/bookings/confirm — Atomic booking confirm (user)
export const confirmBooking = async (
	req: AuthenticatedRequest,
	res: Response
): Promise<void> => {
	const session = await mongoose.startSession();
	session.startTransaction();

	try {
		const userId = req.user?.id;
		if (!userId) {
			await session.abortTransaction();
			res.status(401).json({ message: "Not authorized" });
			return;
		}

		const {
			reservationId,
			eventId,
			eventName,
			eventDate,
			eventTime,
			seatNumbers,
			userEmail,
			userName,
			totalAmount,
		} = req.body;

		if (!reservationId || !eventId || !seatNumbers || totalAmount === undefined) {
			await session.abortTransaction();
			res.status(400).json({ message: "reservationId, eventId, seatNumbers, and totalAmount are required" });
			return;
		}

		if (!mongoose.Types.ObjectId.isValid(reservationId)) {
			await session.abortTransaction();
			res.status(400).json({ message: "Invalid reservationId" });
			return;
		}

		const amount = Number(totalAmount);
		if (!Number.isFinite(amount) || amount <= 0) {
			await session.abortTransaction();
			res.status(400).json({ message: "totalAmount must be a positive number" });
			return;
		}

		// 1. Load and validate reservation
		const reservation = await Reservation.findById(reservationId).session(session);
		if (!reservation) {
			await session.abortTransaction();
			res.status(400).json({ message: "Reservation not found or already consumed" });
			return;
		}

		if (String(reservation.userId) !== userId) {
			await session.abortTransaction();
			res.status(403).json({ message: "Reservation does not belong to you" });
			return;
		}

		if (reservation.expiresAt < new Date()) {
			await session.abortTransaction();
			res.status(400).json({ message: "Reservation has expired. Please select seats again." });
			return;
		}

		// 2. Verify all seats still reserved by this user
		const requestedSeats = Array.isArray(seatNumbers) ? seatNumbers : [];
		const seats = await Seat.find({
			eventId: reservation.eventId,
			seatNumber: { $in: requestedSeats },
			state: "reserved",
			reservedBy: new mongoose.Types.ObjectId(userId),
		}).session(session);

		if (seats.length !== requestedSeats.length) {
			await session.abortTransaction();
			res.status(409).json({ message: "One or more seats are no longer reserved by you" });
			return;
		}

		// 3. Load user
		const user = await User.findById(userId).session(session);
		if (!user) {
			await session.abortTransaction();
			res.status(404).json({ message: "User not found" });
			return;
		}

		// 4. Check wallet balance
		let wallet = await Wallet.findOne({ userEmail: user.email.toLowerCase() }).session(session);
		const currentBalance = wallet ? wallet.balance : 0;
		if (currentBalance < amount) {
			await session.abortTransaction();
			res.status(400).json({ message: "Insufficient wallet balance" });
			return;
		}

		// 5. Deduct wallet
		if (!wallet) {
			wallet = new Wallet({ userId: user._id, userEmail: user.email.toLowerCase(), balance: 0 });
		}
		wallet.balance -= amount;
		await wallet.save({ session });

		// 6. Create debit transaction
		await WalletTransaction.create(
			[{
				userId: user._id,
				userEmail: user.email.toLowerCase(),
				userName: user.name,
				type: "debit",
				amount,
				description: `Ticket booking: ${eventName || eventId}`,
				referenceType: "BOOKING",
				referenceId: reservationId,
			}],
			{ session }
		);

		// 7. Mark seats as booked
		await Seat.updateMany(
			{
				eventId: reservation.eventId,
				seatNumber: { $in: requestedSeats },
				state: "reserved",
				reservedBy: new mongoose.Types.ObjectId(userId),
			},
			{ $set: { state: "booked", reservedBy: null, reservedUntil: null } },
			{ session }
		);

		// 8. Determine event details (fallback to Event doc if not provided)
		let resolvedEventName = eventName;
		let resolvedEventDate = eventDate;
		let resolvedEventTime = eventTime;

		if (!resolvedEventName || !resolvedEventDate) {
			const eventDoc = await Event.findById(eventId).lean();
			if (eventDoc) {
				resolvedEventName = resolvedEventName ?? eventDoc.name;
				resolvedEventDate = resolvedEventDate ?? new Date(eventDoc.date).toISOString().slice(0, 10);
				resolvedEventTime = resolvedEventTime ?? eventDoc.time ?? "TBD";
			}
		}

		// 9. Create booking record
		const [booking] = await Booking.create(
			[{
				eventId: String(eventId),
				eventName: resolvedEventName ?? "Unknown Event",
				eventDate: resolvedEventDate ?? "",
				eventTime: resolvedEventTime ?? "TBD",
				userId: new mongoose.Types.ObjectId(userId),
				userEmail: (userEmail || user.email).toLowerCase(),
				userName: userName || user.name,
				tickets: requestedSeats.length,
				totalAmount: amount,
				seatNumbers: requestedSeats,
				status: "confirmed",
			}],
			{ session }
		);

		// Increment ticketsSold
		if (String(eventId).length === 24) {
			await Event.findByIdAndUpdate(eventId, {
				$inc: { ticketsSold: requestedSeats.length },
			}, { session }).catch(() => null);
		}

		// 10. Delete reservation
		await Reservation.findByIdAndDelete(reservationId).session(session);

		await session.commitTransaction();

		res.status(201).json(toBookingResponse(booking));
	} catch (error) {
		await session.abortTransaction();
		res.status(500).json({ message: "Server error", error });
	} finally {
		session.endSession();
	}
};

// POST /api/admin/bookings/:id/cancel-refund — Admin force cancel + full refund
export const adminCancelBooking = async (
	req: AuthenticatedRequest,
	res: Response
): Promise<void> => {
	const session = await mongoose.startSession();
	session.startTransaction();

	try {
		const { id } = req.params;

		const booking = await Booking.findById(id).session(session);
		if (!booking) {
			await session.abortTransaction();
			res.status(404).json({ message: "Booking not found" });
			return;
		}

		if (booking.status === "cancelled") {
			await session.abortTransaction();
			res.status(409).json({ message: "Booking is already cancelled" });
			return;
		}

		booking.status = "cancelled";
		await booking.save({ session });

		// Release seats
		if (booking.seatNumbers && booking.seatNumbers.length > 0) {
			await Seat.updateMany(
				{ eventId: booking.eventId, seatNumber: { $in: booking.seatNumbers } },
				{ $set: { state: "available", reservedBy: null, reservedUntil: null } },
				{ session }
			);
		}

		// Decrement ticketsSold
		if (String(booking.eventId).length === 24) {
			await Event.findByIdAndUpdate(booking.eventId, {
				$inc: { ticketsSold: -booking.tickets },
			}, { session }).catch(() => null);
		}

		// Full refund to booking owner
		const owner = await User.findOne({ email: booking.userEmail.toLowerCase() }).session(session);
		if (owner) {
			let wallet = await Wallet.findOne({ userEmail: owner.email.toLowerCase() }).session(session);
			if (!wallet) {
				wallet = new Wallet({
					userId: owner._id,
					userEmail: owner.email.toLowerCase(),
					balance: 0,
				});
			}
			wallet.balance += booking.totalAmount;
			await wallet.save({ session });

			await WalletTransaction.create(
				[{
					userId: owner._id,
					userEmail: owner.email.toLowerCase(),
					userName: owner.name,
					type: "credit",
					amount: booking.totalAmount,
					description: `Admin refund for cancelled booking: ${booking.eventName}`,
					referenceType: "BOOKING_CANCEL",
					referenceId: booking._id.toString(),
				}],
				{ session }
			);
		}

		await session.commitTransaction();

		res.status(200).json({
			message: "Booking cancelled and refund issued",
			booking: toBookingResponse(booking),
		});
	} catch (error) {
		await session.abortTransaction();
		res.status(500).json({ message: "Server error", error });
	} finally {
		session.endSession();
	}
};

