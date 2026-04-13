import { Router } from "express";
import { releaseReservation } from "../controllers/seat.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

// DELETE /api/reservations/:reservationId/release
router.delete("/:reservationId/release", protect, releaseReservation);

export default router;
