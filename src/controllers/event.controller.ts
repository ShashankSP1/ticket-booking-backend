import { Request, Response } from "express";
import mongoose from "mongoose";
import Event from "../shared/models/event.model";
import { AuthenticatedRequest } from "../types/auth.types";

// Get all active events (for listing)
export const getAllEvents = async (req: Request, res: Response): Promise<void> => {
	try {
		const { search, sortBy = "date" } = req.query;

		let query: Record<string, unknown> = { isActive: true };

		if (search && typeof search === "string") {
			query.$or = [
				{ name: { $regex: search, $options: "i" } },
				{ venue: { $regex: search, $options: "i" } },
				{ description: { $regex: search, $options: "i" } },
			];
		}

		const sortOptions: Record<string, 1 | -1> = {};
		if (sortBy === "date") {
			sortOptions.date = 1;
		} else if (sortBy === "price-low") {
			sortOptions.price = 1;
		} else if (sortBy === "price-high") {
			sortOptions.price = -1;
		} else if (sortBy === "newest") {
			sortOptions.createdAt = -1;
		}

		const events = await Event.find(query)
			.sort(sortOptions)
			.select("name description date venue price capacity ticketsSold image createdAt");

		res.status(200).json({
			message: "Events retrieved successfully",
			count: events.length,
			events,
		});
	} catch (error) {
		res.status(500).json({ message: "Server error", error });
	}
};

// Get single event detail
export const getEventById = async (req: Request, res: Response): Promise<void> => {
	try {
		const { eventId } = req.params;

		const event = await Event.findById(eventId).populate("createdBy", "name email");

		if (!event) {
			res.status(404).json({ message: "Event not found" });
			return;
		}

		res.status(200).json({
			message: "Event retrieved successfully",
			event,
		});
	} catch (error) {
		res.status(500).json({ message: "Server error", error });
	}
};

// Create event (admin only)
export const createEvent = async (
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

		const creatorId = new mongoose.Types.ObjectId(userId);

		const { name, description, date, venue, price, capacity = 100, image } = req.body;

		if (!name || !date || !venue || !price) {
			res.status(400).json({
				message: "Name, date, venue, and price are required",
			});
			return;
		}

		if (new Date(date) < new Date()) {
			res.status(400).json({ message: "Event date must be in the future" });
			return;
		}

		if (price < 0 || capacity < 1) {
			res.status(400).json({
				message: "Price must be non-negative and capacity must be at least 1",
			});
			return;
		}

		const event = await Event.create({
			name,
			description,
			date,
			venue,
			price,
			capacity,
			image,
			createdBy: creatorId,
		});

		res.status(201).json({
			message: "Event created successfully",
			event,
		});
	} catch (error) {
		res.status(500).json({ message: "Server error", error });
	}
};

// Update event (admin only)
export const updateEvent = async (
	req: AuthenticatedRequest,
	res: Response
): Promise<void> => {
	try {
		const userId = req.user?.id;
		if (!userId) {
			res.status(401).json({ message: "Not authorized" });
			return;
		}

		const { eventId } = req.params;
		const { name, description, date, venue, price, capacity, image, isActive } = req.body;

		const event = await Event.findById(eventId);
		if (!event) {
			res.status(404).json({ message: "Event not found" });
			return;
		}

		if (String(event.createdBy) !== userId) {
			res.status(403).json({ message: "Not authorized to update this event" });
			return;
		}

		if (date && new Date(date) < new Date()) {
			res.status(400).json({ message: "Event date must be in the future" });
			return;
		}

		const updatedEvent = await Event.findByIdAndUpdate(
			eventId,
			{
				name: name || event.name,
				description: description || event.description,
				date: date || event.date,
				venue: venue || event.venue,
				price: price !== undefined ? price : event.price,
				capacity: capacity || event.capacity,
				image: image || event.image,
				isActive: isActive !== undefined ? isActive : event.isActive,
			},
			{ new: true }
		);

		res.status(200).json({
			message: "Event updated successfully",
			event: updatedEvent,
		});
	} catch (error) {
		res.status(500).json({ message: "Server error", error });
	}
};

// Delete event (admin only)
export const deleteEvent = async (
	req: AuthenticatedRequest,
	res: Response
): Promise<void> => {
	try {
		const userId = req.user?.id;
		if (!userId) {
			res.status(401).json({ message: "Not authorized" });
			return;
		}

		const { eventId } = req.params;

		const event = await Event.findById(eventId);
		if (!event) {
			res.status(404).json({ message: "Event not found" });
			return;
		}

		if (String(event.createdBy) !== userId) {
			res.status(403).json({ message: "Not authorized to delete this event" });
			return;
		}

		await Event.findByIdAndDelete(eventId);

		res.status(200).json({
			message: "Event deleted successfully",
		});
	} catch (error) {
		res.status(500).json({ message: "Server error", error });
	}
};

// Get available tickets for an event
export const getAvailableTickets = async (req: Request, res: Response): Promise<void> => {
	try {
		const { eventId } = req.params;

		const event = await Event.findById(eventId).select("name capacity ticketsSold");
		if (!event) {
			res.status(404).json({ message: "Event not found" });
			return;
		}

		const availableTickets = event.capacity - event.ticketsSold;

		res.status(200).json({
			eventId,
			eventName: event.name,
			totalCapacity: event.capacity,
			ticketsSold: event.ticketsSold,
			availableTickets,
		});
	} catch (error) {
		res.status(500).json({ message: "Server error", error });
	}
};
