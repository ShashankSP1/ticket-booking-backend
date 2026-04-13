import { Request, Response } from "express";
import mongoose from "mongoose";
import Seat from "../shared/models/seat.model";
import Reservation from "../shared/models/reservation.model";
import { AuthenticatedRequest } from "../types/auth.types";

const RESERVATION_TTL_MINUTES = 5;

// GET /api/events/:eventId/seats — All seats for an event
export const getSeatsByEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const eventId = req.params.eventId as string;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      res.status(400).json({ message: "Invalid event ID" });
      return;
    }

    const oid = new mongoose.Types.ObjectId(eventId);
    const seats = await Seat.find({ eventId: oid }).sort({ row: 1, col: 1 }).lean();
    res.status(200).json({ seats });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// GET /api/events/:eventId/seats/stats — Seat counts by state
export const getSeatStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const eventId = req.params.eventId as string;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      res.status(400).json({ message: "Invalid event ID" });
      return;
    }

    const oid = new mongoose.Types.ObjectId(eventId);
    const stats = await Seat.aggregate([
      { $match: { eventId: oid } },
      { $group: { _id: "$state", count: { $sum: 1 } } },
    ]);

    const counts: Record<string, number> = { available: 0, reserved: 0, booked: 0 };
    for (const s of stats) {
      counts[s._id as string] = s.count;
    }

    res.status(200).json({ available: counts.available, reserved: counts.reserved, booked: counts.booked });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// POST /api/events/:eventId/seats/bulk — Bulk create seats (admin)
export const bulkCreateSeats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const eventId = req.params.eventId as string;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      res.status(400).json({ message: "Invalid event ID" });
      return;
    }

    const { seats } = req.body as {
      seats: Array<{ seatNumber: string; row: string; col: number }>;
    };

    if (!Array.isArray(seats) || seats.length === 0) {
      res.status(400).json({ message: "seats array is required" });
      return;
    }

    const oid = new mongoose.Types.ObjectId(eventId);

    const ops = seats.map((s) => ({
      updateOne: {
        filter: { eventId: oid, seatNumber: s.seatNumber },
        update: {
          $setOnInsert: {
            eventId: oid,
            seatNumber: s.seatNumber,
            row: s.row,
            col: s.col,
            state: "available" as const,
            reservedBy: null,
            reservedUntil: null,
          },
        },
        upsert: true,
      },
    }));

    const result = await Seat.bulkWrite(ops as any);

    res.status(201).json({
      message: "Seats created",
      inserted: result.upsertedCount,
      skipped: seats.length - result.upsertedCount,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// POST /api/events/:eventId/seats/reserve — Atomically reserve seats (user)
export const reserveSeats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const eventId = req.params.eventId as string;
    const { seatNumbers } = req.body as { seatNumbers: string[] };
    const userId = req.user?.id;

    if (!userId) {
      await session.abortTransaction();
      res.status(401).json({ message: "Not authorized" });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      await session.abortTransaction();
      res.status(400).json({ message: "Invalid event ID" });
      return;
    }

    if (!Array.isArray(seatNumbers) || seatNumbers.length === 0) {
      await session.abortTransaction();
      res.status(400).json({ message: "seatNumbers array is required" });
      return;
    }

    // Load all requested seats within session
    const seats = await Seat.find({
      eventId: new mongoose.Types.ObjectId(eventId),
      seatNumber: { $in: seatNumbers },
    }).session(session);

    if (seats.length !== seatNumbers.length) {
      await session.abortTransaction();
      res.status(404).json({ message: "Some seats not found for this event" });
      return;
    }

    // Check all are available
    const unavailable = seats.filter((s) => s.state !== "available");
    if (unavailable.length > 0) {
      await session.abortTransaction();
      res.status(409).json({
        message: "Seats already taken",
        seats: unavailable.map((s) => s.seatNumber),
      });
      return;
    }

    const expiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);

    // Atomically update all seats to reserved
    const updateResult = await Seat.updateMany(
      {
        eventId: new mongoose.Types.ObjectId(eventId),
        seatNumber: { $in: seatNumbers },
        state: "available", // guard condition for atomicity
      },
      {
        $set: {
          state: "reserved",
          reservedBy: new mongoose.Types.ObjectId(userId),
          reservedUntil: expiresAt,
        },
      },
      { session }
    );

    if (updateResult.modifiedCount !== seatNumbers.length) {
      await session.abortTransaction();
      res.status(409).json({ message: "Seats already taken" });
      return;
    }

    const reservation = await Reservation.create(
      [
        {
          eventId: new mongoose.Types.ObjectId(eventId),
          userId: new mongoose.Types.ObjectId(userId),
          seatNumbers,
          expiresAt,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    res.status(201).json({
      reservationId: reservation[0]?._id,
      expiresAt,
      seats: seatNumbers,
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: "Server error", error });
  } finally {
    session.endSession();
  }
};

// DELETE /api/reservations/:reservationId/release — Release reserved seats
export const releaseReservation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const reservationId = req.params.reservationId as string;
    const userId = req.user?.id;

    if (!userId) {
      await session.abortTransaction();
      res.status(401).json({ message: "Not authorized" });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(reservationId as string)) {
      await session.abortTransaction();
      res.status(400).json({ message: "Invalid reservation ID" });
      return;
    }

    const reservation = await Reservation.findOne({
      _id: new mongoose.Types.ObjectId(reservationId as string),
      userId: new mongoose.Types.ObjectId(userId),
    }).session(session);

    if (!reservation) {
      await session.abortTransaction();
      res.status(404).json({ message: "Reservation not found" });
      return;
    }

    // Release all seats back to available
    await Seat.updateMany(
      {
        eventId: reservation.eventId,
        seatNumber: { $in: reservation.seatNumbers },
        state: "reserved",
        reservedBy: new mongoose.Types.ObjectId(userId),
      },
      {
        $set: { state: "available", reservedBy: null, reservedUntil: null },
      },
      { session }
    );

    await Reservation.findByIdAndDelete(reservationId).session(session);

    await session.commitTransaction();

    res.status(200).json({ message: "Reservation released" });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: "Server error", error });
  } finally {
    session.endSession();
  }
};
