import { type Prisma, type Booking as PrismaBooking } from "../../generated/prisma/client";
import { BookingStatus } from "../../generated/prisma/enums";
import prisma from "../../config/prisma";

type BookingLookup = {
	_id?: string | number;
	id?: string | number;
	reservationId?: string;
	userEmail?: string;
	eventId?: string;
	status?: string;
};

type CreateBookingInput = {
	eventId: string;
	eventName: string;
	eventDate: string;
	eventTime: string;
	reservationId?: string;
	userId?: number;
	userEmail: string;
	userName: string;
	tickets: number;
	totalAmount: number;
	seatNumbers: string[];
	status?: string;
};

export type BookingDocument = PrismaBooking & {
	_id: number;
};

const toBookingDocument = (booking: PrismaBooking): BookingDocument => ({
	...booking,
	_id: booking.id,
});

const parseId = (id?: string | number | null): number | null => {
	if (id == null) return null;
	if (typeof id === "number") return Number.isSafeInteger(id) ? id : null;
	const parsed = parseInt(String(id), 10);
	return Number.isSafeInteger(parsed) ? parsed : null;
};

const parseSelect = (fields?: string) => {
	if (!fields) return undefined;
	return fields
		.split(/\s+/)
		.filter(Boolean)
		.reduce((acc, field) => {
			acc[field] = true;
			return acc;
		}, {} as Record<string, true>);
};

const buildBookingQuery = (queryFn: () => Promise<PrismaBooking | PrismaBooking[] | null>) => {
	let selectedFields: string | undefined;
	let sortOptions: any;
	let session: any;

	const execute = async (): Promise<BookingDocument | BookingDocument[] | null> => {
		const result = await queryFn();

		if (!result) return null;

		const processBooking = (booking: PrismaBooking) => {
			const bookingDoc = toBookingDocument(booking);
			const select = parseSelect(selectedFields);
			if (!select) return bookingDoc;

			return Object.keys(select).reduce((acc, field) => {
				if (field in bookingDoc) {
					(acc as any)[field] = (bookingDoc as any)[field];
				}
				return acc;
			}, {} as Partial<BookingDocument>) as BookingDocument;
		};

		if (Array.isArray(result)) {
			return result.map(processBooking);
		}

		return processBooking(result);
	};

	const query = {
		select(fields: string) {
			selectedFields = fields;
			return query;
		},
		sort(options: any) {
			sortOptions = options;
			return query;
		},
		lean: async () => await execute(),
		session: (_session: any) => {
			session = _session;
			return query;
		},
		then<TResult1 = BookingDocument | BookingDocument[] | null, TResult2 = never>(
			onfulfilled?: ((value: BookingDocument | BookingDocument[] | null) => TResult1 | PromiseLike<TResult1>) | null,
			onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
		) {
			return execute().then(onfulfilled, onrejected);
		},
		catch<TResult = never>(
			onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null
		) {
			return execute().catch(onrejected);
		},
	};

	return query;
};

const Booking = {
	findOne(where: BookingLookup) {
		return buildBookingQuery(async () => {
			const prismaWhere: Prisma.BookingWhereInput = {};
			if (where._id) {
				const id = parseId(where._id);
				if (id !== null) prismaWhere.id = id;
			}
			if (where.id) {
				const id = parseId(where.id);
				if (id !== null) prismaWhere.id = id;
			}
			if (where.reservationId) {
				const id = parseId(where.reservationId);
				if (id !== null) prismaWhere.reservationId = id;
			}
			if (where.userEmail) prismaWhere.userEmail = where.userEmail;
			if (where.eventId) {
				const id = parseId(where.eventId);
				if (id !== null) prismaWhere.eventId = id;
			}
			if (where.status) prismaWhere.status = where.status as BookingStatus;

			return prisma.booking.findFirst({
				where: prismaWhere,
			});
		});
	},

	findById(id: string | number) {
		return buildBookingQuery(async () => {
			const parsedId = parseId(id);
			if (parsedId === null) return null;
			return prisma.booking.findUnique({
				where: {
					id: parsedId,
				},
			});
		});
	},

	find(where?: BookingLookup) {
		return buildBookingQuery(async () => {
			const prismaWhere: Prisma.BookingWhereInput = {};
			if (where) {
				if (where.userEmail) prismaWhere.userEmail = where.userEmail;
				if (where.eventId) {
					const id = parseId(where.eventId);
					if (id !== null) prismaWhere.eventId = id;
				}
				if (where.status) prismaWhere.status = where.status as BookingStatus;
			}

			return prisma.booking.findMany({
				where: prismaWhere,
				orderBy: { createdAt: 'desc' },
			});
		});
	},

	async create(data: CreateBookingInput | CreateBookingInput[]): Promise<BookingDocument | BookingDocument[]> {
		if (Array.isArray(data)) {
			const bookings = await prisma.booking.createManyAndReturn({
				data: data.map(item => ({
					eventId: parseId(item.eventId) || 0,
					eventName: item.eventName,
					eventDate: item.eventDate,
					eventTime: item.eventTime,
					reservationId: parseId(item.reservationId),
					userId: parseId(item.userId),
					userEmail: item.userEmail,
					userName: item.userName,
					tickets: item.tickets,
					totalAmount: item.totalAmount,
					seatNumbers: item.seatNumbers,
					status: (item.status as BookingStatus) || "CONFIRMED",
				})),
			});

			return bookings.map(toBookingDocument);
		} else {
			const booking = await prisma.booking.create({
				data: {
					eventId: parseId(data.eventId) || 0,
					eventName: data.eventName,
					eventDate: data.eventDate,
					eventTime: data.eventTime,
					reservationId: parseId(data.reservationId),
					userId: parseId(data.userId),
					userEmail: data.userEmail,
					userName: data.userName,
					tickets: data.tickets,
					totalAmount: data.totalAmount,
					seatNumbers: data.seatNumbers,
					status: (data.status as BookingStatus) || "CONFIRMED",
				},
			});

			return toBookingDocument(booking);
		}
	},

	async findByIdAndUpdate(id: string | number, update: Partial<CreateBookingInput>): Promise<BookingDocument | null> {
		const parsedId = parseId(id);
		if (parsedId === null) return null;

		const booking = await prisma.booking.update({
			where: { id: parsedId },
			data: {
				...(update.eventId && { eventId: parseId(update.eventId) || 0 }),
				...(update.eventName && { eventName: update.eventName }),
				...(update.eventDate && { eventDate: update.eventDate }),
				...(update.eventTime && { eventTime: update.eventTime }),
				...(update.reservationId !== undefined && { reservationId: parseId(update.reservationId) }),
				...(update.userId !== undefined && { userId: parseId(update.userId) }),
				...(update.userEmail && { userEmail: update.userEmail }),
				...(update.userName && { userName: update.userName }),
				...(update.tickets && { tickets: update.tickets }),
				...(update.totalAmount && { totalAmount: update.totalAmount }),
				...(update.seatNumbers && { seatNumbers: update.seatNumbers }),
				...(update.status && { status: update.status as BookingStatus }),
			},
		});

		return toBookingDocument(booking);
	},

	async updateMany(where: BookingLookup, update: any): Promise<any> {
		const prismaWhere: Prisma.BookingWhereInput = {};
		if (where.eventId) {
			const id = parseId(where.eventId);
			if (id !== null) prismaWhere.eventId = id;
		}
		// Booking filters currently support eventId/status/userEmail only.
		const data: Prisma.BookingUpdateManyMutationInput = {};
		if (update.$set) {
			if (update.$set.status) data.status = update.$set.status as BookingStatus;
		}

		return prisma.booking.updateMany({
			where: prismaWhere,
			data,
		});
	},

	async findByIdAndDelete(id: string | number): Promise<BookingDocument | null> {
		const parsedId = parseId(id);
		if (parsedId === null) return null;

		const booking = await prisma.booking.delete({
			where: { id: parsedId },
		});

		return toBookingDocument(booking);
	},

	async countDocuments(where?: BookingLookup): Promise<number> {
		const prismaWhere: Prisma.BookingWhereInput = {};
		if (where) {
			if (where.eventId) {
				const id = parseId(where.eventId);
				if (id !== null) prismaWhere.eventId = id;
			}
		}

		return prisma.booking.count({
			where: prismaWhere,
		});
	},
};

export default Booking;
