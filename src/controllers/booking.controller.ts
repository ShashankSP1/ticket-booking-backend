import { Request, Response } from "express";
import prisma from "../config/prisma";
import { AuthenticatedRequest } from "../types/auth.types";

const toBookingResponse = (booking: any) => ({
	id: booking._id?.toString(),
	eventId: booking.eventId,
	reservationId: booking.reservationId,
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

		const loggedInUser = await prisma.user.findUnique({
			where: { id: parseInt(req.user.id) },
			select: { name: true, email: true, role: true },
		});

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
			time: string | null;
			price: number;
			capacity: number;
			ticketsSold: number;
		} | null = null;

		// Get event details and check availability
		eventDoc = await prisma.event.findUnique({
			where: { id: parseInt(eventId) },
			select: {
				name: true,
				date: true,
				time: true,
				price: true,
				capacity: true,
				ticketsSold: true,
			},
		});

		if (eventDoc) {
			const available = eventDoc.capacity - eventDoc.ticketsSold;
			if (available < ticketCount) {
				res.status(400).json({
					message: `Only ${available} tickets available`,
				});
				return;
			}
		}

		const resolvedUserEmail = (
			loggedInUser?.role === "USER" ? loggedInUser.email : userEmail
		)?.toLowerCase().trim();
		const resolvedUserName =
			loggedInUser?.role === "USER" ? loggedInUser.name : userName;

		if (!resolvedUserEmail || !resolvedUserName) {
			res.status(400).json({ message: "User name and email are required" });
			return;
		}

		const resolvedEventName = eventName ?? eventDoc?.name;
		const resolvedEventDate =
			eventDate ?? (eventDoc?.date ? eventDoc.date.toISOString().slice(0, 10) : undefined);
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

		const result = await prisma.$transaction(async (tx) => {
			// Create booking
			const booking = await tx.booking.create({
				data: {
					eventId: eventId.toString(),
					eventName: resolvedEventName,
					eventDate: resolvedEventDate,
					eventTime: resolvedEventTime,
					userId: req.user ? parseInt(req.user.id) : 0,
					userEmail: resolvedUserEmail,
					userName: resolvedUserName,
					tickets: ticketCount,
					totalAmount: resolvedTotalAmount,
					status: "CONFIRMED",
					seatNumbers: [], // No specific seats for direct booking
				},
			});

			// Increment ticketsSold
			await tx.event.update({
				where: { id: parseInt(eventId) },
				data: {
					ticketsSold: {
						increment: ticketCount,
					},
				},
			});

			return booking;
		});

		res.status(201).json(toBookingResponse(result));
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
		const bookings = await prisma.booking.findMany({
			orderBy: { createdAt: 'desc' },
		});
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
			const currentUser = await prisma.user.findUnique({
				where: { id: parseInt(req.user.id) },
				select: { email: true },
			});

			email = currentUser?.email;
		}

		if (!email) {
			res.status(400).json({ message: "Email is required" });
			return;
		}

		const bookings = await prisma.booking.findMany({
			where: {
				userEmail: decodeURIComponent(email).toLowerCase().trim(),
			},
			orderBy: { createdAt: 'desc' },
		});

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

		const user = await prisma.user.findUnique({
			where: { id: parseInt(req.user.id) },
			select: { email: true },
		});

		if (!user) {
			res.status(404).json({ message: "User not found" });
			return;
		}

		const bookings = await prisma.booking.findMany({
			where: {
				userEmail: user.email.toLowerCase().trim(),
			},
			orderBy: { createdAt: 'desc' },
		});
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
	try {
		const rawId = req.params.id;
		const id = Array.isArray(rawId) ? rawId[0] : rawId;
		const userId = req.user?.id;

		if (!id) {
			res.status(400).json({ message: "Booking ID is required" });
			return;
		}

		if (!userId) {
			res.status(401).json({ message: "Not authorized" });
			return;
		}

		const idNum = parseInt(id);
		if (isNaN(idNum)) {
			res.status(400).json({ message: "Invalid booking ID" });
			return;
		}

		await prisma.$transaction(async (tx) => {
			const booking = await tx.booking.findUnique({
				where: { id: idNum },
			});

			if (!booking) {
				throw new Error("Booking not found");
			}

			// Users can only cancel their own bookings
			if (req.user?.role === "user" && booking.userId && booking.userId.toString() !== userId) {
				throw new Error("Not authorized to cancel this booking");
			}

			if (booking.status === "CANCELLED") {
				throw new Error("Booking is already cancelled");
			}

			// Update booking status
			await tx.booking.update({
				where: { id: booking.id },
				data: { status: "CANCELLED" },
			});

			// Release seats back to available
			if (booking.seatNumbers && booking.seatNumbers.length > 0) {
				const eventIdNum = booking.eventId;
				if (eventIdNum) {
					await tx.seat.updateMany({
						where: {
							eventId: eventIdNum,
							seatNumber: { in: booking.seatNumbers },
						},
						data: {
							state: "AVAILABLE",
							reservedBy: null,
							reservedUntil: null,
						},
					});
				}
			}

			// Decrement ticketsSold
			const eventIdNum = booking.eventId;
			if (eventIdNum) {
				await tx.event.update({
					where: { id: eventIdNum },
					data: {
						ticketsSold: {
							decrement: booking.tickets,
						},
					},
				});
			}

			// Refund wallet (full refund)
			const user = await tx.user.findUnique({
				where: { id: booking.userId || parseInt(userId) },
			});

			if (user) {
				let wallet = await tx.wallet.findUnique({
					where: { userId: user.id },
				});

				if (!wallet) {
					wallet = await tx.wallet.create({
						data: {
							userId: user.id,
							userEmail: user.email,
							balance: 0,
						},
					});
				}

				await tx.wallet.update({
					where: { id: wallet.id },
					data: {
						balance: {
							increment: booking.totalAmount,
						},
					},
				});

				await tx.walletTransaction.create({
					data: {
						userId: user.id,
						userEmail: user.email,
						userName: user.name,
						type: "CREDIT",
						amount: booking.totalAmount,
						description: `Refund for cancelled booking: ${booking.eventName}`,
						referenceType: "BOOKING_CANCEL",
						referenceId: booking.id.toString(),
					},
				});
			}
		});

		// Get updated booking for response
		const updatedBooking = await prisma.booking.findUnique({
			where: { id: idNum },
		});

		res.status(200).json({
			message: "Booking cancelled successfully",
			booking: updatedBooking ? toBookingResponse(updatedBooking) : null,
		});
	} catch (error: any) {
		res.status(500).json({ message: error.message || "Server error", error });
	}
};

// POST /api/bookings/confirm — Atomic booking confirm (user)
export const confirmBooking = async (
	req: AuthenticatedRequest,
	res: Response
): Promise<void> => {
	try {
		const userId = req.user?.id;
		if (!userId) {
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
			res.status(400).json({ message: "reservationId, eventId, seatNumbers, and totalAmount are required" });
			return;
		}

		const amount = Number(totalAmount);
		if (!Number.isFinite(amount) || amount <= 0) {
			res.status(400).json({ message: "totalAmount must be a positive number" });
			return;
		}

		const requestedSeats = Array.isArray(seatNumbers) ? seatNumbers : [];
		if (requestedSeats.length === 0) {
			res.status(400).json({ message: "seatNumbers must be a non-empty array" });
			return;
		}

		const result = await prisma.$transaction(async (tx) => {
			// Check for existing booking
			const existingBooking = await tx.booking.findFirst({
				where: { reservationId: reservationId },
			});

			if (existingBooking) {
				return { booking: existingBooking };
			}

			// 1. Load and validate reservation
			const reservation = await tx.reservation.findUnique({
				where: { id: parseInt(reservationId) },
			});

			if (!reservation) {
				throw new Error("Reservation not found or already consumed");
			}

			if (reservation.userId.toString() !== userId) {
				throw new Error("Reservation does not belong to you");
			}

			if (reservation.eventId.toString() !== eventId.toString()) {
				throw new Error("Reservation does not match eventId");
			}

			if (reservation.expiresAt < new Date()) {
				throw new Error("Reservation has expired. Please select seats again.");
			}

			// 2. Verify all seats still reserved by this user
			const reservationSeatSet = new Set(reservation.seatNumbers);
			const isSeatMismatch =
				requestedSeats.length !== reservation.seatNumbers.length ||
				requestedSeats.some((seat: string) => !reservationSeatSet.has(seat));

			if (isSeatMismatch) {
				throw new Error("seatNumbers do not match reservation");
			}

			const seats = await tx.seat.findMany({
				where: {
					eventId: reservation.eventId,
					seatNumber: { in: requestedSeats },
					state: "RESERVED",
					reservedBy: reservation.userId,
				},
			});

			if (seats.length !== requestedSeats.length) {
				throw new Error("One or more seats are no longer reserved by you");
			}

			// 3. Load user
			const user = await tx.user.findUnique({
				where: { id: reservation.userId },
			});

			if (!user) {
				throw new Error("User not found");
			}

			// 4/5. Atomically debit wallet with balance guard (race-safe)
			const wallet = await tx.wallet.findFirst({
				where: {
					userEmail: user.email.toLowerCase(),
					balance: { gte: amount },
				},
			});

			if (!wallet) {
				throw new Error("Insufficient wallet balance");
			}

			await tx.wallet.update({
				where: { id: wallet.id },
				data: {
					balance: {
						decrement: amount,
					},
				},
			});

			// 6. Create debit transaction
			await tx.walletTransaction.create({
				data: {
					userId: user.id,
					userEmail: user.email.toLowerCase(),
					userName: user.name,
					type: "DEBIT",
					amount,
					description: `Ticket booking: ${eventName || eventId}`,
					referenceType: "BOOKING",
					referenceId: reservationId,
				},
			});

			// 7. Mark seats as booked
			await tx.seat.updateMany({
				where: {
					eventId: reservation.eventId,
					seatNumber: { in: requestedSeats },
					state: "RESERVED",
					reservedBy: reservation.userId,
				},
				data: {
					state: "BOOKED",
					reservedBy: null,
					reservedUntil: null,
				},
			});

			// 8. Verify seats are booked
			const bookedSeatsCount = await tx.seat.count({
				where: {
					eventId: reservation.eventId,
					seatNumber: { in: requestedSeats },
					state: "BOOKED",
				},
			});

			if (bookedSeatsCount !== requestedSeats.length) {
				throw new Error("Seats no longer available");
			}

			// 9. Determine event details (fallback to Event doc if not provided)
			let resolvedEventName = eventName;
			let resolvedEventDate = eventDate;
			let resolvedEventTime = eventTime;

			if (!resolvedEventName || !resolvedEventDate) {
				const eventDoc = await tx.event.findUnique({
					where: { id: parseInt(eventId) },
				});
				if (eventDoc) {
					resolvedEventName = resolvedEventName ?? eventDoc.name;
					resolvedEventDate = resolvedEventDate ?? eventDoc.date.toISOString().slice(0, 10);
					resolvedEventTime = resolvedEventTime ?? eventDoc.time ?? "TBD";
				}
			}

			// 10. Create booking record
			const booking = await tx.booking.create({
				data: {
					eventId: eventId.toString(),
					reservationId: reservationId.toString(),
					eventName: resolvedEventName ?? "Unknown Event",
					eventDate: resolvedEventDate ?? "",
					eventTime: resolvedEventTime ?? "TBD",
					userId: reservation.userId,
					userEmail: (userEmail || user.email).toLowerCase(),
					userName: userName || user.name,
					tickets: requestedSeats.length,
					totalAmount: amount,
					seatNumbers: requestedSeats,
					status: "CONFIRMED",
				},
			});

			// 11. Increment ticketsSold
			await tx.event.update({
				where: { id: parseInt(eventId) },
				data: {
					ticketsSold: {
						increment: requestedSeats.length,
					},
				},
			});

			// 12. Delete reservation
			await tx.reservation.delete({
				where: { id: reservation.id },
			});

			return { booking };
		});

		res.status(201).json(toBookingResponse(result.booking));
	} catch (error: any) {
		res.status(500).json({ message: error.message || "Server error", error });
	}
};

// POST /api/admin/bookings/:id/cancel-refund — Admin force cancel + full refund
export const adminCancelBooking = async (
	req: AuthenticatedRequest,
	res: Response
): Promise<void> => {
	try {
		const { id } = req.params;
		const idStr = Array.isArray(id) ? id[0] : id;
		
		if (!idStr) {
			res.status(400).json({ message: "Booking ID is required" });
			return;
		}

		const idNum = parseInt(idStr);
		if (isNaN(idNum)) {
			res.status(400).json({ message: "Invalid booking ID" });
			return;
		}

		const result = await prisma.$transaction(async (tx) => {
			const booking = await tx.booking.findUnique({
				where: { id: idNum },
			});

			if (!booking) {
				throw new Error("Booking not found");
			}

			if (booking.status === "CANCELLED") {
				throw new Error("Booking is already cancelled");
			}

			// Update booking status
			const updatedBooking = await tx.booking.update({
				where: { id: idNum },
				data: { status: "CANCELLED" },
			});

			// Release seats
			if (booking.seatNumbers && booking.seatNumbers.length > 0) {
				const eventIdNum = booking.eventId;
				if (eventIdNum) {
					await tx.seat.updateMany({
						where: {
							eventId: eventIdNum,
							seatNumber: { in: booking.seatNumbers },
						},
						data: {
							state: "AVAILABLE",
							reservedBy: null,
							reservedUntil: null,
						},
					});
				}
			}

			// Decrement ticketsSold
			const eventIdNum = booking.eventId;
			if (eventIdNum) {
				await tx.event.update({
					where: { id: eventIdNum },
					data: {
						ticketsSold: {
							decrement: booking.tickets,
						},
					},
				});
			}

			// Full refund to booking owner
			const owner = await tx.user.findFirst({
				where: { email: booking.userEmail.toLowerCase() },
			});

			if (owner) {
				let wallet = await tx.wallet.findFirst({
					where: { userEmail: owner.email.toLowerCase() },
				});

				if (!wallet) {
					wallet = await tx.wallet.create({
						data: {
							userId: owner.id,
							userEmail: owner.email.toLowerCase(),
							balance: 0,
						},
					});
				}

				await tx.wallet.update({
					where: { id: wallet.id },
					data: {
						balance: {
							increment: booking.totalAmount,
						},
					},
				});

				await tx.walletTransaction.create({
					data: {
						userId: owner.id,
						userEmail: owner.email.toLowerCase(),
						userName: owner.name,
						type: "CREDIT",
						amount: booking.totalAmount,
						description: `Admin refund for cancelled booking: ${booking.eventName}`,
						referenceType: "BOOKING_CANCEL",
						referenceId: booking.id.toString(),
					},
				});
			}

			return { booking: updatedBooking };
		});

		res.status(200).json({
			message: "Booking cancelled and refund issued",
			booking: toBookingResponse(result.booking),
		});
	} catch (error: any) {
		res.status(500).json({ message: error.message || "Server error", error });
	}
};

