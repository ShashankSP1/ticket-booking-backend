// WalletTopupRequest model interfaces for Prisma/PostgreSQL
import { PaymentMode, TopupStatus } from "../../generated/prisma/enums";

export interface WalletTopupRequest {
  id: number;
  userId: number;
  userEmail: string;
  userName: string;
  amount: number;
  paymentMode: PaymentMode;
  receiptUrl?: string | null;
  receiptPublicId?: string | null;
  declarationAccepted: boolean;
  status: TopupStatus;
  adminId?: number | null;
  adminRemarks?: string | null;
  resolvedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletTopupRequestWithRelations extends WalletTopupRequest {
  user: {
    id: number;
    name: string;
    email: string;
  };
  admin?: {
    id: number;
    name: string;
    email: string;
  } | null;
}

export interface CreateWalletTopupRequestInput {
  userId: number;
  userEmail: string;
  userName: string;
  amount: number;
  paymentMode: PaymentMode;
  receiptUrl?: string;
  receiptPublicId?: string;
  declarationAccepted?: boolean;
}

export interface UpdateWalletTopupRequestInput {
  status?: TopupStatus;
  adminId?: number;
  adminRemarks?: string;
  resolvedAt?: Date;
}

export interface WalletTopupRequestFilters {
  userId?: number;
  userEmail?: string;
  status?: TopupStatus;
  paymentMode?: PaymentMode;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
}
