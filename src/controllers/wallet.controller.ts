import { Response } from "express";
import Wallet from "../shared/models/wallet.model";
import WalletTopupRequest from "../shared/models/walletTopupRequest.model";
import WalletTransaction from "../shared/models/walletTransaction.model";
import User from "../shared/models/user.model";
import { AuthenticatedRequest } from "../types/auth.types";
import mongoose from "mongoose";
import { uploadReceiptToCloudinary } from "../config/cloudinary";

// Create wallet topup request
export const createTopupRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { amount, paymentMode, declarationAccepted } = req.body;
    const file = (req as any).file;
    const parsedAmount = Number(amount);
    const declarationAcceptedBool =
      declarationAccepted === true || declarationAccepted === "true";

    // Validation
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 100000) {
      return res.status(400).json({ error: "Invalid amount. Must be between 1 and 100000" });
    }

    if (!paymentMode || !["UPI", "Debit Card", "Credit Card", "Bank Transfer", "Net Banking"].includes(paymentMode)) {
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

    // Create topup request
    const topupRequest = new WalletTopupRequest({
      userId: req.user?.id,
      userEmail: user.email.toLowerCase(),
      userName: user.name,
      amount: parsedAmount,
      paymentMode,
      receiptUrl,
      receiptPublicId,
      declarationAccepted: declarationAcceptedBool,
      status: "pending",
    });

    await topupRequest.save();

    return res.status(201).json({
      id: topupRequest._id,
      userEmail: topupRequest.userEmail,
      userName: topupRequest.userName,
      amount: topupRequest.amount,
      paymentMode: topupRequest.paymentMode,
      receiptUrl: topupRequest.receiptUrl,
      status: "pending",
      createdAt: topupRequest.createdAt,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get user's topup requests
export const getUserTopupRequests = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await User.findById(req.user?.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const requests = await WalletTopupRequest.find({ userEmail: user.email.toLowerCase() })
      .sort({ createdAt: -1 });

    // Transform response to include id field
    const transformedRequests = requests.map((req) => ({
      id: req._id,
      userId: req.userId,
      userEmail: req.userEmail,
      userName: req.userName,
      amount: req.amount,
      paymentMode: req.paymentMode,
      receiptUrl: req.receiptUrl,
      status: req.status,
      createdAt: req.createdAt,
      resolvedAt: req.resolvedAt,
      adminRemarks: req.adminRemarks,
    }));

    return res.status(200).json({
      requests: transformedRequests,
      count: transformedRequests.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get wallet balance
export const getWalletBalance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await User.findById(req.user?.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    let wallet = await Wallet.findOne({ userEmail: user.email.toLowerCase() });

    if (!wallet) {
      // Create wallet if doesn't exist
      wallet = new Wallet({
        userId: req.user?.id,
        userEmail: user.email.toLowerCase(),
        balance: user.walletBalance || 0,
      });
      await wallet.save();
    }

    return res.status(200).json({
      balance: wallet.balance,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get wallet transactions
export const getWalletTransactions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await User.findById(req.user?.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const transactions = await WalletTransaction.find({ userEmail: user.email.toLowerCase() })
      .sort({ createdAt: -1 });

    // Transform response to include id field
    const transformedTransactions = transactions.map((tx) => ({
      id: tx._id,
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get all topup requests (admin only)
export const getAllTopupRequests = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status = "pending" } = req.query;

    const query: any = {};
    if (status) {
      query.status = status;
    }

    const requests = await WalletTopupRequest.find(query)
      .sort({ createdAt: -1 });

    // Transform response to include id field
    const transformedRequests = requests.map((req) => ({
      id: req._id,
      userId: req.userId,
      userEmail: req.userEmail,
      userName: req.userName,
      amount: req.amount,
      paymentMode: req.paymentMode,
      receiptUrl: req.receiptUrl,
      declarationAccepted: req.declarationAccepted,
      status: req.status,
      createdAt: req.createdAt,
      resolvedAt: req.resolvedAt,
      adminRemarks: req.adminRemarks,
    }));

    return res.status(200).json({
      requests: transformedRequests,
      count: transformedRequests.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Approve topup request (atomic + idempotent)
export const approveTopupRequest = async (req: AuthenticatedRequest, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { adminRemarks = "" } = req.body;

    // Atomically claim the request — only if still pending (prevents double-approval race)
    const topupRequest = await WalletTopupRequest.findOneAndUpdate(
      { _id: id, status: "pending" },
      {
        $set: {
          status: "approved",
          adminId: req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : undefined,
          adminRemarks,
          resolvedAt: new Date(),
        },
      },
      { new: true, session }
    );

    if (!topupRequest) {
      // Either not found or already processed
      await session.abortTransaction();
      const existing = await WalletTopupRequest.findById(id).lean();
      if (!existing) {
        return res.status(404).json({ error: "Top-up request not found" });
      }
      return res.status(409).json({ error: `Request already ${(existing as any).status}. Cannot approve.` });
    }

    // Credit user's wallet
    let wallet = await Wallet.findOneAndUpdate(
      { userEmail: topupRequest.userEmail },
      { $inc: { balance: topupRequest.amount } },
      { new: true, session }
    );

    if (!wallet) {
      // Create wallet if absent
      const created = await Wallet.create(
        [{ userId: topupRequest.userId, userEmail: topupRequest.userEmail, balance: topupRequest.amount }],
        { session }
      );
      wallet = created[0] ?? null;
    }

    // Create credit transaction for user
    await WalletTransaction.create(
      [{
        userId: topupRequest.userId,
        userEmail: topupRequest.userEmail,
        userName: topupRequest.userName,
        type: "credit",
        amount: topupRequest.amount,
        description: `Wallet top-up approved via ${topupRequest.paymentMode}`,
        referenceType: "TOPUP_REQUEST",
        referenceId: topupRequest._id.toString(),
      }],
      { session }
    );

    await session.commitTransaction();

    return res.status(200).json({
      message: "Top-up approved",
      requestId: topupRequest._id,
      newBalance: wallet?.balance ?? 0,
    });
  } catch (error: any) {
    await session.abortTransaction();
    res.status(500).json({ error: error.message });
  } finally {
    session.endSession();
  }
};

// Reject topup request (atomic)
export const rejectTopupRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { adminRemarks = "" } = req.body;

    const topupRequest = await WalletTopupRequest.findOneAndUpdate(
      { _id: id, status: "pending" },
      {
        $set: {
          status: "rejected",
          adminId: req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : undefined,
          adminRemarks,
          resolvedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!topupRequest) {
      const existing = await WalletTopupRequest.findById(id).lean();
      if (!existing) {
        return res.status(404).json({ error: "Top-up request not found" });
      }
      return res.status(409).json({ error: `Request already ${(existing as any).status}. Cannot reject.` });
    }

    return res.status(200).json({
      message: "Top-up request rejected",
      requestId: topupRequest._id,
      status: "rejected",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
