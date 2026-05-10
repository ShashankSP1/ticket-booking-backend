// WalletTransaction model interfaces for Prisma/PostgreSQL

import { WalletTransactionType, ReferenceType } from "../../generated/prisma/enums";

export interface WalletTransaction {
  id: number;
  userId: number;
  userEmail: string;
  userName: string;
  type: WalletTransactionType;
  amount: number;
  description: string;
  referenceType: ReferenceType;
  referenceId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletTransactionWithUser extends WalletTransaction {
  user: {
    id: number;
    name: string;
    email: string;
  };
}

export interface CreateWalletTransactionInput {
  userId: number;
  userEmail: string;
  userName: string;
  type: WalletTransactionType;
  amount: number;
  description: string;
  referenceType: ReferenceType;
  referenceId: string;
}

export interface WalletTransactionFilters {
  userId?: number;
  userEmail?: string;
  type?: WalletTransactionType;
  referenceType?: ReferenceType;
  referenceId?: string;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
}
