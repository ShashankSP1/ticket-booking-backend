import { type Admin as PrismaAdmin } from "../../generated/prisma/client";
import prisma from "../../config/prisma";

type AdminLookup = {
	email?: string;
	id?: number;
};

type CreateAdminInput = {
	name: string;
	email: string;
	password: string;
	role?: string;
};

export type AdminDocument = PrismaAdmin & {
	_id: number;
};

const toAdminDocument = (admin: PrismaAdmin): AdminDocument => ({
	...admin,
	_id: admin.id,
});

const Admin = {
	async findOne(where: AdminLookup): Promise<AdminDocument | null> {
		const admin = await prisma.admin.findFirst({
			where: {
				...(where.email ? { email: where.email } : {}),
				...(where.id ? { id: where.id } : {}),
			},
		});

		return admin ? toAdminDocument(admin) : null;
	},

	async create(data: CreateAdminInput): Promise<AdminDocument> {
		const admin = await prisma.admin.create({
			data: {
				name: data.name,
				email: data.email,
				password: data.password,
				role: data.role ?? "admin",
			},
		});

		return toAdminDocument(admin);
	},
};

export default Admin;
