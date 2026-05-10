import { Request, Response } from "express";
import prisma from "../config/prisma";
import { SeatState } from "../generated/prisma/enums";
import { AuthenticatedRequest } from "../types/auth.types";

const RESERVATION_TTL_MINUTES = 5;

const parseId = (value: unknown): number | null => {
  if (value == null) return null;
  if (typeof value === "number") return Number.isSafeInteger(value) ? value : null;
  const asString = String(value);
  if (!/^\d+$/.test(asString)) return null;
  const parsed = parseInt(asString, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const toApiSeatState = (state: SeatState): "available" | "reserved" | "booked" => {
  if (state === SeatState.AVAILABLE) return "available";
  if (state === SeatState.RESERVED) return "reserved";
  return "booked";
};

// GET /api/events/:eventId/seats — All seats for an event
export const getSeatsByEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const eventId = parseId(req.params.eventId);

    if (eventId === null) {
      res.status(400).json({ message: "Invalid event ID" });
      return;
    }

    const seats = await prisma.seat.findMany({
      where: { eventId },
      orderBy: [{ row: "asc" }, { col: "asc" }],
    });

    res.status(200).json({ seats });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// GET /api/events/:eventId/seats/stats — Seat counts by state
export const getSeatStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const eventId = parseId(req.params.eventId);

    if (eventId === null) {
      res.status(400).json({ message: "Invalid event ID" });
      return;
    }

    const stats = await prisma.seat.groupBy({
      by: ["state"],
      where: { eventId },
      _count: { _all: true },
    });

    const counts: Record<string, number> = { available: 0, reserved: 0, booked: 0 };
    for (const s of stats) {
      counts[toApiSeatState(s.state)] = s._count._all;
    }

    res.status(200).json({ available: counts.available, reserved: counts.reserved, booked: counts.booked });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// POST /api/events/:eventId/seats/bulk — Bulk create seats (admin)
export const bulkCreateSeats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const eventId = parseId(req.params.eventId);

    if (eventId === null) {
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

    const result = await prisma.seat.createMany({
      data: seats.map((s) => ({
        eventId,
        seatNumber: s.seatNumber,
        row: s.row,
        col: s.col,
        state: SeatState.AVAILABLE,
        reservedBy: null,
        reservedUntil: null,
      })),
      skipDuplicates: true,
    });

    res.status(201).json({
      message: "Seats created",
      inserted: result.count,
      skipped: seats.length - result.count,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// POST /api/events/:eventId/seats/reserve — Atomically reserve seats (user)
export const reserveSeats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const eventId = parseId(req.params.eventId);
    const { seatNumbers } = req.body as { seatNumbers: string[] };
    const userId = parseId(req.user?.id);

    if (!userId) {
      res.status(401).json({ message: "Not authorized" });
      return;
    }

    if (eventId === null) {
      res.status(400).json({ message: "Invalid event ID" });
      return;
    }

    if (!Array.isArray(seatNumbers) || seatNumbers.length === 0) {
      res.status(400).json({ message: "seatNumbers array is required" });
      return;
    }

    const expiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);

    const reservation = await prisma.$transaction(async (tx) => {
      const seats = await tx.seat.findMany({
        where: {
          eventId,
          seatNumber: { in: seatNumbers },
        },
      });

      if (seats.length !== seatNumbers.length) {
        return { kind: "not-found" as const };
      }

      const unavailable = seats.filter((s) => s.state !== SeatState.AVAILABLE);
      if (unavailable.length > 0) {
        return {
          kind: "unavailable" as const,
          unavailable: unavailable.map((s) => s.seatNumber),
        };
      }

      const updateResult = await tx.seat.updateMany({
        where: {
          eventId,
          seatNumber: { in: seatNumbers },
          state: SeatState.AVAILABLE,
        },
        data: {
          state: SeatState.RESERVED,
          reservedBy: userId,
          reservedUntil: expiresAt,
        },
      });

      if (updateResult.count !== seatNumbers.length) {
        return { kind: "race-lost" as const };
      }

      const createdReservation = await tx.reservation.create({
        data: {
          eventId,
          userId,
          seatNumbers,
          expiresAt,
        },
      });

      return { kind: "ok" as const, reservationId: createdReservation.id };
    });

    if (reservation.kind === "not-found") {
      res.status(404).json({ message: "Some seats not found for this event" });
      return;
    }

    if (reservation.kind === "unavailable") {
      res.status(409).json({
        message: "Seats already taken",
        seats: reservation.unavailable,
      });
      return;
    }

    if (reservation.kind === "race-lost") {
      res.status(409).json({ message: "Seats already taken" });
      return;
    }

    res.status(201).json({
      reservationId: reservation.reservationId,
      expiresAt,
      seats: seatNumbers,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// DELETE /api/reservations/:reservationId/release — Release reserved seats
export const releaseReservation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const reservationId = parseId(req.params.reservationId);
    const userId = parseId(req.user?.id);

    if (!userId) {
      res.status(401).json({ message: "Not authorized" });
      return;
    }

    if (reservationId === null) {
      res.status(400).json({ message: "Invalid reservation ID" });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findFirst({
        where: {
          id: reservationId,
          userId,
        },
      });

      if (!reservation) {
        return { kind: "not-found" as const };
      }

      await tx.seat.updateMany({
        where: {
          eventId: reservation.eventId,
          seatNumber: { in: reservation.seatNumbers },
          state: SeatState.RESERVED,
          reservedBy: userId,
        },
        data: {
          state: SeatState.AVAILABLE,
          reservedBy: null,
          reservedUntil: null,
        },
      });

      await tx.reservation.delete({ where: { id: reservationId } });
      return { kind: "ok" as const };
    });

    if (result.kind === "not-found") {
      res.status(404).json({ message: "Reservation not found" });
      return;
    }

    res.status(200).json({ message: "Reservation released" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
