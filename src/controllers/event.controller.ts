import { Request, Response } from "express";
import mongoose from "mongoose";
import Event from "../shared/models/event.model";
import { AuthenticatedRequest } from "../types/auth.types";

const toEventDate = (date: unknown, time: unknown): Date | null => {
	if (typeof date !== "string" || !date.trim()) {
		return null;
	}

	if (typeof time === "string" && time.trim()) {
		const combined = new Date(`${date} ${time}`);
		if (!Number.isNaN(combined.getTime())) {
			return combined;
		}
	}

	const dateOnly = new Date(date);
	if (!Number.isNaN(dateOnly.getTime())) {
		return dateOnly;
	}

	return null;
};

const isValidHHmm = (value: string): boolean => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const toEventResponse = (event: any) => ({
	id: event._id?.toString(),
	name: event.name,
	description: event.description,
	date: event.date,
	time: event.time,
	venue: event.venue,
	price: event.price,
	capacity: event.capacity,
	ticketsSold: event.ticketsSold,
	image: event.image,
	createdBy: event.createdBy,
	isActive: event.isActive,
	createdAt: event.createdAt,
	updatedAt: event.updatedAt,
});

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
			.select("name description date time venue price capacity ticketsSold image createdBy isActive createdAt updatedAt")
			.lean();

		res.status(200).json({
			message: "Events retrieved successfully",
			count: events.length,
			events: events.map(toEventResponse),
		});
	} catch (error) {
		res.status(500).json({ message: "Server error", error });
	}
};

// Get single event detail
export const getEventById = async (req: Request, res: Response): Promise<void> => {
	try {
		const { eventId } = req.params;

		const event = await Event.findById(eventId)
			.select("name description date time venue price capacity ticketsSold image createdBy isActive")
			.populate("createdBy", "name email")
			.lean();

		if (!event) {
			res.status(404).json({ message: "Event not found" });
			return;
		}

		res.status(200).json({
			message: "Event retrieved successfully",
			event: toEventResponse(event),
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

		const {
			name,
			description,
			date,
			time,
			venue,
			price,
			capacity = 100,
			image,
		} = req.body;

		if (!name || !date || !venue || !price) {
			res.status(400).json({
				message: "Name, date, venue, and price are required",
			});
			return;
		}

		const normalizedDate = toEventDate(date, time);
		if (!normalizedDate) {
			res.status(400).json({
				message: "Invalid date/time. Use date as YYYY-MM-DD and time like 06:00 PM",
			});
			return;
		}

		if (typeof time !== "string" || !isValidHHmm(time)) {
			res.status(400).json({ message: "Time must be valid HH:mm format" });
			return;
		}

		if (normalizedDate.getTime() < Date.now()) {
			res.status(400).json({ message: "Event date must be in the future" });
			return;
		}

		if (price <= 0 || capacity < 1) {
			res.status(400).json({
				message: "Price must be greater than 0 and capacity must be at least 1",
			});
			return;
		}

		const event = await Event.create({
			name,
			description,
			date: normalizedDate,
			time,
			venue,
			price,
			capacity,
			image,
			createdBy: creatorId,
		});

		res.status(201).json({
			message: "Event created successfully",
			event: toEventResponse(event),
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
		const { name, description, date, time, venue, price, capacity, image, isActive } =
			req.body;

		const event = await Event.findById(eventId);
		if (!event) {
			res.status(404).json({ message: "Event not found" });
			return;
		}

		if (String(event.createdBy) !== userId) {
			res.status(403).json({ message: "Not authorized to update this event" });
			return;
		}

		let normalizedDate: Date | undefined;
		if (date || time) {
			const fallbackDate = new Date(event.date).toISOString().slice(0, 10);
			normalizedDate = toEventDate(date ?? fallbackDate, time) ?? undefined;

			if (!normalizedDate) {
				res.status(400).json({
					message: "Invalid date/time. Use date as YYYY-MM-DD and time like 06:00 PM",
				});
				return;
			}

			if (normalizedDate.getTime() < Date.now()) {
				res.status(400).json({ message: "Event date must be in the future" });
				return;
			}
		}

		const updatedEvent = await Event.findByIdAndUpdate(
			eventId,
			{
				name: name || event.name,
				description: description || event.description,
				date: normalizedDate || event.date,
				time: time || event.time,
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
			event: toEventResponse(updatedEvent),
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
