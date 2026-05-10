import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
	prismaClient?: PrismaClient;
};

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaNeon({
	connectionString: databaseUrl,
});

const prisma =
	globalForPrisma.prismaClient ??
	new PrismaClient({
		adapter,
	});

if (!globalForPrisma.prismaClient) {
	globalForPrisma.prismaClient = prisma;
}

export default prisma;
