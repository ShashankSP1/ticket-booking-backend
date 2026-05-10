import { type Prisma, type User as PrismaUser } from "../../generated/prisma/client";
import { UserRole } from "../../generated/prisma/enums";
import prisma from "../../config/prisma";

type UserLookup = {
  email?: string;
  id?: number | string;
};

type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  role?: string;
  walletBalance?: number;
};

export type UserDocument = PrismaUser & {
  _id: number;
};

const toUserDocument = (user: PrismaUser): UserDocument => ({
  ...user,
  _id: user.id,
});

const parseId = (id?: number | string | null): number | null => {
  if (id == null) return null;
  if (typeof id === "number") return Number.isSafeInteger(id) ? id : null;
  const parsed = parseInt(id, 10);
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

const buildUserQuery = (queryFn: () => Promise<PrismaUser | null>) => {
  let selectedFields: string | undefined;

  const execute = async (): Promise<UserDocument | null> => {
    const user = await queryFn();
    if (!user) return null;
    const userDoc = toUserDocument(user);
    const select = parseSelect(selectedFields);
    if (!select) return userDoc;

    return Object.keys(select).reduce((acc, field) => {
      if (field in userDoc) {
        (acc as any)[field] = (userDoc as any)[field];
      }
      return acc;
    }, {} as Partial<UserDocument>) as UserDocument;
  };

  const query = {
    select(fields: string) {
      selectedFields = fields;
      return query;
    },
    lean: async () => await execute(),
    session: (_session: unknown) => query,
    then<TResult1 = UserDocument | null, TResult2 = never>(
      onfulfilled?: ((value: UserDocument | null) => TResult1 | PromiseLike<TResult1>) | null,
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

const User = {
  findOne(where: UserLookup) {
    return buildUserQuery(async () => {
      const prismaWhere: Prisma.UserWhereInput = {};
      if (where.email) prismaWhere.email = where.email;
      if (where.id) {
        const parsedId = parseId(where.id);
        if (parsedId !== null) prismaWhere.id = parsedId;
      }

      return prisma.user.findFirst({
        where: prismaWhere,
      });
    });
  },

  findById(id?: number | string) {
    return buildUserQuery(async () => {
      const parsedId = parseId(id ?? null);
      if (parsedId === null) return null;
      return prisma.user.findUnique({
        where: {
          id: parsedId,
        },
      });
    });
  },

  async create(data: CreateUserInput): Promise<UserDocument> {
    const userRole = data.role ? (data.role.toUpperCase() as UserRole) : UserRole.USER;
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: data.password,
        role: userRole,
        walletBalance: data.walletBalance ?? 1000,
      },
    });

    return toUserDocument(user);
  },
};

export default User;