import { Router } from "express";
import {
	createEvent,
	deleteEvent,
	getAllEvents,
	getEventById,
	updateEvent,
	getAvailableTickets,
} from "../controllers/event.controller";
import { protect, requireAdmin } from "../middleware/auth.middleware";

const router = Router();

// Public routes
router.get("/", getAllEvents);
router.get("/:eventId", getEventById);
router.get("/:eventId/available-tickets", getAvailableTickets);

// Admin-only routes
router.post("/", protect, requireAdmin, createEvent);
router.put("/:eventId", protect, requireAdmin, updateEvent);
router.delete("/:eventId", protect, requireAdmin, deleteEvent);

export default router;
