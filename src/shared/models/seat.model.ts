import { type Prisma, type Seat as PrismaSeat } from "../../generated/prisma/client";
import { SeatState } from "../../generated/prisma/enums";
import prisma from "../../config/prisma";

type LowerSeatState = "available" | "reserved" | "booked";

type SeatWithRelations = PrismaSeat & {
  event?: { id: number; name: string };
  user?: { id: number; name: string; email: string } | null;
};

export type Seat = Omit<PrismaSeat, "state"> & {
  _id: number;
  state: LowerSeatState;
};

export type SeatDocument = Seat & {
  event?: {
    id: number;
    name: string;
  };
  reservedByUser?: {
    id: number;
    name: string;
    email: string;
  } | null;
};

export interface CreateSeatInput {
  eventId: number;
  seatNumber: string;
  row: string;
  col: number;
}

export interface UpdateSeatInput {
  state?: LowerSeatState;
  reservedBy?: unknown | null;
  reservedUntil?: Date | null;
}

type SeatFilterInput = {
  eventId?: unknown;
  seatNumber?: string | { $in?: string[] };
  state?: LowerSeatState;
  reservedBy?: unknown;
  reservedUntil?: { $lt?: Date };
};

const toDbState = (state: LowerSeatState): SeatState => {
  if (state === "available") return SeatState.AVAILABLE;
  if (state === "reserved") return SeatState.RESERVED;
  return SeatState.BOOKED;
};

const fromDbState = (state: SeatState): LowerSeatState => {
  if (state === SeatState.AVAILABLE) return "available";
  if (state === SeatState.RESERVED) return "reserved";
  return "booked";
};

const parseId = (id: unknown): number | null => {
  if (id == null) return null;
  if (typeof id === "number") return Number.isSafeInteger(id) ? id : null;
  const asString = typeof id === "string" ? id : String(id);
  if (!/^\d+$/.test(asString)) return null;
  const parsed = parseInt(asString, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const toSeatDocument = (seat: SeatWithRelations): SeatDocument => ({
  ...seat,
  _id: seat.id,
  state: fromDbState(seat.state),
  reservedByUser: seat.user
    ? {
        id: seat.user.id,
        name: seat.user.name,
        email: seat.user.email,
      }
    : null,
});

const buildUpdateData = (data: UpdateSeatInput): Prisma.SeatUncheckedUpdateInput => {
  const payload: Prisma.SeatUncheckedUpdateInput = {};
  if (data.state !== undefined) payload.state = toDbState(data.state);
  if (data.reservedBy !== undefined) {
    if (data.reservedBy === null) {
      payload.reservedBy = null;
    } else {
      const parsedReservedBy = parseId(data.reservedBy);
      if (parsedReservedBy !== null) payload.reservedBy = parsedReservedBy;
    }
  }
  if (data.reservedUntil !== undefined) payload.reservedUntil = data.reservedUntil;
  return payload;
};

const buildSeatWhere = (filter?: SeatFilterInput): { where: Prisma.SeatWhereInput; invalidId: boolean } => {
  const where: Prisma.SeatWhereInput = {};
  let invalidId = false;

  if (!filter) return { where, invalidId };

  if (filter.eventId !== undefined) {
    const eventId = parseId(filter.eventId);
    if (eventId === null) invalidId = true;
    else where.eventId = eventId;
  }

  if (filter.seatNumber !== undefined) {
    if (typeof filter.seatNumber === "string") {
      where.seatNumber = filter.seatNumber;
    } else if (Array.isArray(filter.seatNumber.$in)) {
      where.seatNumber = { in: filter.seatNumber.$in };
    }
  }

  if (filter.state !== undefined) {
    where.state = toDbState(filter.state);
  }

  if (filter.reservedBy !== undefined) {
    const reservedBy = parseId(filter.reservedBy);
    if (reservedBy === null) invalidId = true;
    else where.reservedBy = reservedBy;
  }

  if (filter.reservedUntil?.$lt) {
    where.reservedUntil = { lt: filter.reservedUntil.$lt };
  }

  return { where, invalidId };
};

const buildSeatQuery = (queryFn: () => Promise<SeatWithRelations[]>) => {
  let sortBy: Record<string, 1 | -1> | undefined;

  const execute = async (): Promise<SeatDocument[]> => {
    let rows = await queryFn();

    if (sortBy) {
      const keys = Object.keys(sortBy);
      rows = rows.sort((a, b) => {
        for (const key of keys) {
          const dir = sortBy?.[key] ?? 1;
          const av = (a as Record<string, unknown>)[key];
          const bv = (b as Record<string, unknown>)[key];
          if (av === bv) continue;
          const left = av instanceof Date ? av.getTime() : String(av);
          const right = bv instanceof Date ? bv.getTime() : String(bv);
          return left > right ? dir : -dir;
        }
        return 0;
      });
    }

    return rows.map(toSeatDocument);
  };

  const query = {
    sort(options: Record<string, 1 | -1>) {
      sortBy = options;
      return query;
    },
    lean: async () => execute(),
    session: (_session: unknown) => query,
    then<TResult1 = SeatDocument[], TResult2 = never>(
      onfulfilled?: ((value: SeatDocument[]) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) {
      return execute().then(onfulfilled, onrejected);
    },
    catch<TResult = never>(
      onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
    ) {
      return execute().catch(onrejected);
    },
  };

  return query;
};

export const SeatModel = {
  async create(data: CreateSeatInput): Promise<SeatDocument | null> {
    try {
      const seat = await prisma.seat.create({
        data: {
          ...data,
          state: SeatState.AVAILABLE,
        },
        include: {
          event: {
            select: {
              id: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
      return toSeatDocument(seat);
    } catch (error) {
      console.error("Error creating seat:", error);
      return null;
    }
  },

  async findById(id: number): Promise<SeatDocument | null> {
    try {
      const seat = await prisma.seat.findUnique({
        where: { id },
        include: {
          event: {
            select: {
              id: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
      return seat ? toSeatDocument(seat) : null;
    } catch (error) {
      console.error("Error finding seat by id:", error);
      return null;
    }
  },

  async update(id: number, data: UpdateSeatInput): Promise<SeatDocument | null> {
    try {
      const seat = await prisma.seat.update({
        where: { id },
        data: buildUpdateData(data),
        include: {
          event: {
            select: {
              id: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
      return toSeatDocument(seat);
    } catch (error) {
      console.error("Error updating seat:", error);
      return null;
    }
  },

  async delete(id: number): Promise<boolean> {
    try {
      await prisma.seat.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      console.error("Error deleting seat:", error);
      return false;
    }
  },

  async updateByEventAndSeatNumber(
    eventId: number,
    seatNumber: string,
    data: UpdateSeatInput
  ): Promise<SeatDocument | null> {
    try {
      const seat = await prisma.seat.update({
        where: { eventId_seatNumber: { eventId, seatNumber } },
        data: buildUpdateData(data),
        include: {
          event: {
            select: {
              id: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
      return toSeatDocument(seat);
    } catch (error) {
      console.error("Error updating seat by eventId and seatNumber:", error);
      return null;
    }
  },
};

const Seat = {
  find(filter?: SeatFilterInput) {
    return buildSeatQuery(async () => {
      const { where, invalidId } = buildSeatWhere(filter);
      if (invalidId) return [];

      return prisma.seat.findMany({
        where,
        include: {
          event: {
            select: {
              id: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    });
  },

  async aggregate(pipeline: Array<Record<string, unknown>>): Promise<Array<{ _id: string; count: number }>> {
    const matchStage = pipeline.find((stage) => "$match" in stage)?.$match as SeatFilterInput | undefined;
    const { where, invalidId } = buildSeatWhere(matchStage);
    if (invalidId) return [];

    const grouped = await prisma.seat.groupBy({
      by: ["state"],
      where,
      _count: {
        _all: true,
      },
    });

    return grouped.map((item) => ({
      _id: fromDbState(item.state),
      count: item._count._all,
    }));
  },

  async bulkWrite(
    ops: Array<{
      updateOne: {
        filter: { eventId: unknown; seatNumber: string };
        update: { $setOnInsert?: Partial<CreateSeatInput & { state: LowerSeatState; reservedBy: number | null; reservedUntil: Date | null }> };
        upsert?: boolean;
      };
    }>
  ): Promise<{ upsertedCount: number }> {
    let upsertedCount = 0;

    for (const op of ops) {
      const { filter, update, upsert } = op.updateOne;
      if (!upsert) continue;

      const eventId = parseId(filter.eventId);
      if (eventId === null) continue;

      const existing = await prisma.seat.findUnique({
        where: {
          eventId_seatNumber: {
            eventId,
            seatNumber: filter.seatNumber,
          },
        },
      });

      if (existing) continue;

      const payload = update.$setOnInsert;
      if (!payload) continue;

      await prisma.seat.create({
        data: {
          eventId,
          seatNumber: payload.seatNumber ?? filter.seatNumber,
          row: payload.row ?? "",
          col: payload.col ?? 0,
          state: payload.state ? toDbState(payload.state) : SeatState.AVAILABLE,
          reservedBy: payload.reservedBy ?? null,
          reservedUntil: payload.reservedUntil ?? null,
        },
      });

      upsertedCount += 1;
    }

    return { upsertedCount };
  },

  async updateMany(
    filter: SeatFilterInput,
    update: { $set?: UpdateSeatInput },
    _options?: unknown
  ): Promise<{ modifiedCount: number }> {
    const { where, invalidId } = buildSeatWhere(filter);
    if (invalidId) return { modifiedCount: 0 };

    const result = await prisma.seat.updateMany({
      where,
      data: buildUpdateData(update.$set ?? {}),
    });

    return { modifiedCount: result.count };
  },
};

export default Seat;