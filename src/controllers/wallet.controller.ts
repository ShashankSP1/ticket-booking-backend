import { Response } from "express";
import User from "../shared/models/user.model";
import { AuthenticatedRequest } from "../types/auth.types";
import prisma from "../config/prisma";
import { type Prisma } from "../generated/prisma/client";
import { PaymentMode, ReferenceType, TopupStatus, WalletTransactionType } from "../generated/prisma/enums";
import { uploadReceiptToCloudinary } from "../config/cloudinary";

const parseId = (value: unknown): number | null => {
  if (value == null) return null;
  if (typeof value === "number") return Number.isSafeInteger(value) ? value : null;
  const asString = String(value);
  if (!/^\d+$/.test(asString)) return null;
  const parsed = parseInt(asString, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const normalizePaymentMode = (value: unknown): PaymentMode | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");

  if (normalized === "UPI") return PaymentMode.UPI;
  if (normalized === "DEBIT_CARD") return PaymentMode.DEBIT_CARD;
  if (normalized === "CREDIT_CARD") return PaymentMode.CREDIT_CARD;
  if (normalized === "BANK_TRANSFER") return PaymentMode.BANK_TRANSFER;
  if (normalized === "NET_BANKING") return PaymentMode.NET_BANKING;

  return null;
};

const normalizeTopupStatus = (value: unknown): TopupStatus | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === "PENDING") return TopupStatus.PENDING;
  if (normalized === "APPROVED") return TopupStatus.APPROVED;
  if (normalized === "REJECTED") return TopupStatus.REJECTED;
  return null;
};

const toApiTopupStatus = (status: TopupStatus): "pending" | "approved" | "rejected" => {
  if (status === TopupStatus.PENDING) return "pending";
  if (status === TopupStatus.APPROVED) return "approved";
  return "rejected";
};

type TopupListItem = {
  id: number;
  userId: number;
  userEmail: string;
  userName: string;
  amount: number;
  paymentMode: PaymentMode;
  receiptUrl: string | null;
  declarationAccepted: boolean;
  status: TopupStatus;
  createdAt: Date;
  resolvedAt: Date | null;
  adminRemarks: string | null;
};

const mapTopupResponse = (request: TopupListItem) => ({
  id: request.id,
  userId: request.userId,
  userEmail: request.userEmail,
  userName: request.userName,
  amount: request.amount,
  paymentMode: request.paymentMode,
  receiptUrl: request.receiptUrl,
  declarationAccepted: request.declarationAccepted,
  status: toApiTopupStatus(request.status),
  createdAt: request.createdAt,
  resolvedAt: request.resolvedAt,
  adminRemarks: request.adminRemarks,
});

// Create wallet topup request
export const createTopupRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { amount, paymentMode, declarationAccepted } = req.body;
    const file = (req as any).file;
    const parsedAmount = Number(amount);
    const paymentModeEnum = normalizePaymentMode(paymentMode);
    const declarationAcceptedBool =
      declarationAccepted === true || declarationAccepted === "true";

    // Validation
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 100000) {
      return res.status(400).json({ error: "Invalid amount. Must be between 1 and 100000" });
    }

    if (!paymentModeEnum) {
      return res.status(400).json({ error: "Invalid payment mode" });
    }

    if (!declarationAcceptedBool) {
      return res.status(400).json({ error: "Declaration must be accepted" });
    }

    if (!file) {
      return res.status(400).json({ error: "Receipt file is required" });
    }

    let receiptUrl = `/uploads/receipts/${file.filename}`;
    let receiptPublicId: string | undefined;
    const cloudinaryResult = await uploadReceiptToCloudinary(file.path);
    if (cloudinaryResult) {
      receiptUrl = cloudinaryResult.url;
      receiptPublicId = cloudinaryResult.publicId;
    }

    const user = await User.findById(req.user?.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const userId = parseId(req.user?.id);
    if (userId === null) {
      return res.status(401).json({ error: "Not authorized" });
    }

    const topupRequest = await prisma.walletTopupRequest.create({
      data: {
        userId,
        userEmail: user.email.toLowerCase(),
        userName: user.name,
        amount: parsedAmount,
        paymentMode: paymentModeEnum,
        receiptUrl,
        receiptPublicId: receiptPublicId ?? null,
        declarationAccepted: declarationAcceptedBool,
        status: TopupStatus.PENDING,
      },
    });

    return res.status(201).json({
      id: topupRequest.id,
      userEmail: topupRequest.userEmail,
      userName: topupRequest.userName,
      amount: topupRequest.amount,
      paymentMode: topupRequest.paymentMode,
      receiptUrl: topupRequest.receiptUrl,
      status: "pending",
      createdAt: topupRequest.createdAt,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
};

// Get user's topup requests
export const getUserTopupRequests = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await User.findById(req.user?.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const requests = await prisma.walletTopupRequest.findMany({
      where: { userEmail: user.email.toLowerCase() },
      orderBy: { createdAt: "desc" },
    });

    const transformedRequests = requests.map(mapTopupResponse);

    return res.status(200).json({
      requests: transformedRequests,
      count: transformedRequests.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
};

// Get wallet balance
export const getWalletBalance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await User.findById(req.user?.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const userId = parseId(req.user?.id);
    if (userId === null) {
      return res.status(401).json({ error: "Not authorized" });
    }

    let wallet = await prisma.wallet.findUnique({
      where: { userEmail: user.email.toLowerCase() },
    });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          userId,
          userEmail: user.email.toLowerCase(),
          balance: user.walletBalance || 0,
        },
      });
    }

    return res.status(200).json({
      balance: wallet.balance,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
};

// Get wallet transactions
export const getWalletTransactions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await User.findById(req.user?.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const transactions = await prisma.walletTransaction.findMany({
      where: { userEmail: user.email.toLowerCase() },
      orderBy: { createdAt: "desc" },
    });

    const transformedTransactions = transactions.map((tx) => ({
      id: tx.id,
      userEmail: tx.userEmail,
      userName: tx.userName,
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      referenceType: tx.referenceType,
      referenceId: tx.referenceId,
      createdAt: tx.createdAt,
    }));

    return res.status(200).json({
      transactions: transformedTransactions,
      count: transformedTransactions.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
};

// Get all topup requests (admin only)
export const getAllTopupRequests = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status = "pending" } = req.query;

    const statusFilter = status ? normalizeTopupStatus(status) : null;
    if (status && !statusFilter) {
      return res.status(400).json({ error: "Invalid status filter" });
    }

    const query: Prisma.WalletTopupRequestFindManyArgs = {
      orderBy: { createdAt: "desc" },
    };

    if (statusFilter) {
      query.where = { status: statusFilter };
    }

    const requests = await prisma.walletTopupRequest.findMany(query);

    const transformedRequests = requests.map(mapTopupResponse);

    return res.status(200).json({
      requests: transformedRequests,
      count: transformedRequests.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
};

// Approve topup request (atomic + idempotent)
export const approveTopupRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { adminRemarks = "" } = req.body;
    const requestId = parseId(id);
    if (requestId === null) {
      return res.status(400).json({ error: "Invalid request id" });
    }

    const adminId = parseId(req.user?.id);

    const txResult = await prisma.$transaction(async (tx) => {
      const claimed = await tx.walletTopupRequest.updateMany({
        where: { id: requestId, status: TopupStatus.PENDING },
        data: {
          status: TopupStatus.APPROVED,
          adminId,
          adminRemarks,
          resolvedAt: new Date(),
        },
      });

      if (claimed.count === 0) {
        const existing = await tx.walletTopupRequest.findUnique({ where: { id: requestId } });
        if (!existing) {
          return { kind: "not-found" as const };
        }
        return { kind: "already-processed" as const, status: existing.status };
      }

      const topupRequest = await tx.walletTopupRequest.findUnique({ where: { id: requestId } });
      if (!topupRequest) {
        return { kind: "not-found" as const };
      }

      let wallet = await tx.wallet.findUnique({
        where: { userEmail: topupRequest.userEmail },
      });

      if (!wallet) {
        wallet = await tx.wallet.create({
          data: {
            userId: topupRequest.userId,
            userEmail: topupRequest.userEmail,
            balance: topupRequest.amount,
          },
        });
      } else {
        wallet = await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: topupRequest.amount } },
        });
      }

      await tx.walletTransaction.create({
        data: {
          userId: topupRequest.userId,
          userEmail: topupRequest.userEmail,
          userName: topupRequest.userName,
          type: WalletTransactionType.CREDIT,
          amount: topupRequest.amount,
          description: `Wallet top-up approved via ${topupRequest.paymentMode}`,
          referenceType: ReferenceType.TOPUP_REQUEST,
          referenceId: String(topupRequest.id),
        },
      });

      return { kind: "success" as const, topupRequest, wallet };
    });

    if (txResult.kind === "not-found") {
      return res.status(404).json({ error: "Top-up request not found" });
    }

    if (txResult.kind === "already-processed") {
      return res.status(409).json({
        error: `Request already ${toApiTopupStatus(txResult.status)}. Cannot approve.`,
      });
    }

    return res.status(200).json({
      message: "Top-up approved",
      requestId: txResult.topupRequest.id,
      newBalance: txResult.wallet.balance,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
};

// Reject topup request (atomic)
export const rejectTopupRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { adminRemarks = "" } = req.body;
    const requestId = parseId(id);
    if (requestId === null) {
      return res.status(400).json({ error: "Invalid request id" });
    }

    const adminId = parseId(req.user?.id);

    const updated = await prisma.walletTopupRequest.updateMany({
      where: { id: requestId, status: TopupStatus.PENDING },
      data: {
        status: TopupStatus.REJECTED,
        adminId,
        adminRemarks,
        resolvedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      const existing = await prisma.walletTopupRequest.findUnique({ where: { id: requestId } });
      if (!existing) {
        return res.status(404).json({ error: "Top-up request not found" });
      }
      return res.status(409).json({
        error: `Request already ${toApiTopupStatus(existing.status)}. Cannot reject.`,
      });
    }

    return res.status(200).json({
      message: "Top-up request rejected",
      requestId,
      status: "rejected",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
};
