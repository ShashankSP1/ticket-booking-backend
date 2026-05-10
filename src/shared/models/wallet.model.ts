import { type Prisma, type Wallet as PrismaWallet } from "../../generated/prisma/client";
import prisma from "../../config/prisma";

export interface Wallet extends PrismaWallet {
  _id: number;
}

export interface CreateWalletInput {
  userId: number;
  userEmail: string;
  balance?: number;
}

export interface UpdateWalletInput {
  balance?: number;
}

export interface WalletDocument extends Wallet {
  user?: {
    id: number;
    name: string;
    email: string;
  };
}

const toWalletDocument = (wallet: PrismaWallet): Wallet => ({
  ...wallet,
  _id: wallet.id,
});

export const WalletModel = {
  // Create a new wallet
  async create(
    data: CreateWalletInput
  ): Promise<Wallet | null> {
    try {
      const wallet = await prisma.wallet.create({
        data,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
      return toWalletDocument(wallet);
    } catch (error) {
      console.error("Error creating wallet:", error);
      return null;
    }
  },

  // Find wallet by ID
  async findById(id: number): Promise<Wallet | null> {
    try {
      const wallet = await prisma.wallet.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
      return wallet ? toWalletDocument(wallet) : null;
    } catch (error) {
      console.error("Error finding wallet by id:", error);
      return null;
    }
  },

  // Find wallet by userId
  async findByUserId(userId: number): Promise<Wallet | null> {
    try {
      const wallet = await prisma.wallet.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
      return wallet ? toWalletDocument(wallet) : null;
    } catch (error) {
      console.error("Error finding wallet by userId:", error);
      return null;
    }
  },

  // Find wallet by email
  async findByEmail(userEmail: string): Promise<Wallet | null> {
    try {
      const wallet = await prisma.wallet.findUnique({
        where: { userEmail },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
      return wallet ? toWalletDocument(wallet) : null;
    } catch (error) {
      console.error("Error finding wallet by email:", error);
      return null;
    }
  },

  // Update wallet
  async update(
    id: number,
    data: UpdateWalletInput
  ): Promise<Wallet | null> {
    try {
      const wallet = await prisma.wallet.update({
        where: { id },
        data,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
      return toWalletDocument(wallet);
    } catch (error) {
      console.error("Error updating wallet:", error);
      return null;
    }
  },

  // Update wallet by userId
  async updateByUserId(
    userId: number,
    data: UpdateWalletInput
  ): Promise<Wallet | null> {
    try {
      const wallet = await prisma.wallet.update({
        where: { userId },
        data,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
      return toWalletDocument(wallet);
    } catch (error) {
      console.error("Error updating wallet by userId:", error);
      return null;
    }
  },

  // Delete wallet
  async delete(id: number): Promise<boolean> {
    try {
      await prisma.wallet.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      console.error("Error deleting wallet:", error);
      return false;
    }
  },

  // Get all wallets (with pagination)
  async findAll(
    limit: number = 10,
    offset: number = 0
  ): Promise<Wallet[]> {
    try {
      const wallets = await prisma.wallet.findMany({
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        take: limit,
        skip: offset,
      });
      return wallets.map(toWalletDocument);
    } catch (error) {
      console.error("Error finding all wallets:", error);
      return [];
    }
  },
};
