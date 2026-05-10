import { type Prisma, type Reservation as PrismaReservation } from "../../generated/prisma/client";
import prisma from "../../config/prisma";

export type ReservationDocument = PrismaReservation & {
  _id: number;
};

type ReservationFilter = {
  _id?: unknown;
  userId?: unknown;
  eventId?: unknown;
  expiresAt?: { $lt?: Date };
};

type CreateReservationInput = {
  eventId: unknown;
  userId: unknown;
  seatNumbers: string[];
  expiresAt: Date;
};

const toReservationDocument = (reservation: PrismaReservation): ReservationDocument => ({
  ...reservation,
  _id: reservation.id,
});

const parseId = (id: unknown): number | null => {
  if (id == null) return null;
  if (typeof id === "number") return Number.isSafeInteger(id) ? id : null;
  const asString = typeof id === "string" ? id : String(id);
  if (!/^\d+$/.test(asString)) return null;
  const parsed = parseInt(asString, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const buildWhere = (filter?: ReservationFilter): { where: Prisma.ReservationWhereInput; invalidId: boolean } => {
  const where: Prisma.ReservationWhereInput = {};
  let invalidId = false;

  if (!filter) return { where, invalidId };

  if (filter._id !== undefined) {
    const id = parseId(filter._id);
    if (id === null) invalidId = true;
    else where.id = id;
  }

  if (filter.userId !== undefined) {
    const userId = parseId(filter.userId);
    if (userId === null) invalidId = true;
    else where.userId = userId;
  }

  if (filter.eventId !== undefined) {
    const eventId = parseId(filter.eventId);
    if (eventId === null) invalidId = true;
    else where.eventId = eventId;
  }

  if (filter.expiresAt?.$lt) {
    where.expiresAt = { lt: filter.expiresAt.$lt };
  }

  return { where, invalidId };
};

const buildReservationQuery = <TResult extends PrismaReservation | PrismaReservation[] | null>(
  queryFn: () => Promise<TResult>
) => {
  let selectedFields: string | undefined;
  let sortOptions: Record<string, 1 | -1> | undefined;

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

  const execute = async (): Promise<ReservationDocument | ReservationDocument[] | null> => {
    const result = await queryFn();
    if (!result) return null;

    const applySelect = (item: ReservationDocument): ReservationDocument => {
      const select = parseSelect(selectedFields);
      if (!select) return item;
      return Object.keys(select).reduce((acc, field) => {
        if (field in item) {
          (acc as Record<string, unknown>)[field] = (item as Record<string, unknown>)[field];
        }
        return acc;
      }, {} as Partial<ReservationDocument>) as ReservationDocument;
    };

    const toDocs = (rows: PrismaReservation[]) => {
      let docs = rows.map(toReservationDocument);

      if (sortOptions) {
        const keys = Object.keys(sortOptions);
        docs = docs.sort((a, b) => {
          for (const key of keys) {
            const dir = sortOptions?.[key] ?? 1;
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

      return docs;
    };

    if (Array.isArray(result)) {
      return toDocs(result).map(applySelect);
    }

    return applySelect(toReservationDocument(result));
  };

  const query = {
    select(fields: string) {
      selectedFields = fields;
      return query;
    },
    sort(options: Record<string, 1 | -1>) {
      sortOptions = options;
      return query;
    },
    lean: async () => execute(),
    session: (_session: unknown) => query,
    then<TResult1 = ReservationDocument | ReservationDocument[] | null, TResult2 = never>(
      onfulfilled?:
        | ((value: ReservationDocument | ReservationDocument[] | null) => TResult1 | PromiseLike<TResult1>)
        | null,
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

const Reservation = {
  find(filter?: ReservationFilter) {
    const query = buildReservationQuery(async () => {
      const { where, invalidId } = buildWhere(filter);
      if (invalidId) return [];
      return prisma.reservation.findMany({ where });
    });

    return query as {
      select: (fields: string) => unknown;
      sort: (options: Record<string, 1 | -1>) => unknown;
      lean: () => Promise<ReservationDocument[]>;
      session: (_session: unknown) => unknown;
      then: <TResult1 = ReservationDocument[], TResult2 = never>(
        onfulfilled?: ((value: ReservationDocument[]) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
      ) => Promise<TResult1 | TResult2>;
      catch: <TResult = never>(
        onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
      ) => Promise<ReservationDocument[] | TResult>;
    };
  },

  findOne(filter: ReservationFilter) {
    return buildReservationQuery(async () => {
      const { where, invalidId } = buildWhere(filter);
      if (invalidId) return null;
      return prisma.reservation.findFirst({ where });
    });
  },

  findById(id: unknown) {
    return buildReservationQuery(async () => {
      const parsedId = parseId(id);
      if (parsedId === null) return null;
      return prisma.reservation.findUnique({ where: { id: parsedId } });
    });
  },

  async create(
    data: CreateReservationInput | CreateReservationInput[],
    _options?: unknown
  ): Promise<ReservationDocument[]> {
    const rows = Array.isArray(data) ? data : [data];
    const docs: ReservationDocument[] = [];

    for (const row of rows) {
      const eventId = parseId(row.eventId);
      const userId = parseId(row.userId);
      if (eventId === null || userId === null) continue;

      const created = await prisma.reservation.create({
        data: {
          eventId,
          userId,
          seatNumbers: row.seatNumbers,
          expiresAt: row.expiresAt,
        },
      });

      docs.push(toReservationDocument(created));
    }

    return docs;
  },

  deleteMany(filter: { _id?: { $in?: unknown[] } }) {
    return {
      async then<TResult1 = { deletedCount: number }, TResult2 = never>(
        onfulfilled?: ((value: { deletedCount: number }) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
      ) {
        const ids = filter._id?.$in ?? [];
        const parsedIds = ids.map(parseId).filter((id): id is number => id !== null);

        const result = await prisma.reservation.deleteMany({
          where: {
            id: { in: parsedIds },
          },
        });

        return Promise.resolve({ deletedCount: result.count }).then(onfulfilled, onrejected);
      },
      catch<TResult = never>(
        onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
      ) {
        const ids = filter._id?.$in ?? [];
        const parsedIds = ids.map(parseId).filter((id): id is number => id !== null);

        return prisma.reservation
          .deleteMany({ where: { id: { in: parsedIds } } })
          .then((result) => ({ deletedCount: result.count }))
          .catch(onrejected);
      },
    };
  },

  findByIdAndDelete(id: unknown) {
    let shouldLean = false;

    const execute = async (): Promise<ReservationDocument | null> => {
      const parsedId = parseId(id);
      if (parsedId === null) return null;
      try {
        const deleted = await prisma.reservation.delete({ where: { id: parsedId } });
        return shouldLean ? toReservationDocument(deleted) : toReservationDocument(deleted);
      } catch {
        return null;
      }
    };

    const query = {
      session: (_session: unknown) => query,
      lean: async () => {
        shouldLean = true;
        return execute();
      },
      then<TResult1 = ReservationDocument | null, TResult2 = never>(
        onfulfilled?: ((value: ReservationDocument | null) => TResult1 | PromiseLike<TResult1>) | null,
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
  },
};

export default Reservation;
