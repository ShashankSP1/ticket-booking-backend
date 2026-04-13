import cron from "node-cron";
import Seat from "../shared/models/seat.model";
import Reservation from "../shared/models/reservation.model";

/**
 * Runs every 60 seconds.
 * Finds all seats where state = "reserved" AND reservedUntil < now,
 * resets them to "available", and deletes the associated Reservation docs.
 */
export const startReservationExpiryJob = (): void => {
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();

      // Find expired reservations
      const expiredReservations = await Reservation.find({ expiresAt: { $lt: now } }).lean();

      if (expiredReservations.length === 0) return;

      const reservationIds = expiredReservations.map((r) => r._id);

      // Collect all seat numbers to release per event
      for (const reservation of expiredReservations) {
        await Seat.updateMany(
          {
            eventId: reservation.eventId,
            seatNumber: { $in: reservation.seatNumbers },
            state: "reserved",
            reservedBy: reservation.userId,
          },
          { $set: { state: "available", reservedBy: null, reservedUntil: null } }
        );
      }

      // Clean up expired reservations
      await Reservation.deleteMany({ _id: { $in: reservationIds } });

      // Also catch any orphaned reserved seats whose reservedUntil has passed
      await Seat.updateMany(
        { state: "reserved", reservedUntil: { $lt: now } },
        { $set: { state: "available", reservedBy: null, reservedUntil: null } }
      );

      console.log(`[expiry-job] Released ${expiredReservations.length} expired reservation(s)`);
    } catch (err) {
      console.error("[expiry-job] Error during reservation expiry:", err);
    }
  });

  console.log("[expiry-job] Reservation expiry job started (runs every 60s)");
};
