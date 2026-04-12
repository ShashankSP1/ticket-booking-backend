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

// Approve topup request (atomic transaction)
export const approveTopupRequest = async (req: AuthenticatedRequest, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { adminRemarks = "" } = req.body;

    // Find the topup request
    const topupRequest = await WalletTopupRequest.findById(id).session(session);

    if (!topupRequest) {
      await session.abortTransaction();
      return res.status(404).json({ error: "Top-up request not found" });
    }

    // Check if already resolved
    if (topupRequest.status !== "pending") {
      await session.abortTransaction();
      return res.status(409).json({ 
        error: `Request already ${topupRequest.status}. Cannot approve.` 
      });
    }

    // Get or create user's wallet
    let wallet = await Wallet.findOne({ userEmail: topupRequest.userEmail }).session(session);

    if (!wallet) {
      wallet = new Wallet({
        userId: topupRequest.userId,
        userEmail: topupRequest.userEmail,
        balance: topupRequest.amount,
      });
    } else {
      wallet.balance += topupRequest.amount;
    }

    await wallet.save({ session });

    // Get or create admin's wallet (for debit)
    const admin = await User.findById(req.user?.id).session(session);
    if (!admin) {
      await session.abortTransaction();
      return res.status(404).json({ error: "Admin not found" });
    }

    let adminWallet = await Wallet.findOne({ userEmail: admin.email.toLowerCase() }).session(session);

    if (!adminWallet) {
      adminWallet = new Wallet({
        userId: req.user?.id,
        userEmail: admin.email.toLowerCase(),
        balance: 0,
      });
    }

    // Check if admin has sufficient balance
    if (adminWallet.balance < topupRequest.amount) {
      await session.abortTransaction();
      return res.status(400).json({ 
        error: "Insufficient admin wallet balance to approve this request" 
      });
    }

    adminWallet.balance -= topupRequest.amount;
    await adminWallet.save({ session });

    // Create wallet transaction for user (credit)
    const userTransaction = new WalletTransaction({
      userId: topupRequest.userId,
      userEmail: topupRequest.userEmail,
      userName: topupRequest.userName,
      type: "credit",
      amount: topupRequest.amount,
      description: `Wallet top-up approved via ${topupRequest.paymentMode}`,
      referenceType: "TOPUP_REQUEST",
      referenceId: topupRequest._id.toString(),
    });

    await userTransaction.save({ session });

    // Create wallet transaction for admin (debit)
    const adminTransaction = new WalletTransaction({
      userId: req.user?.id,
      userEmail: admin.email.toLowerCase(),
      userName: admin.name,
      type: "debit",
      amount: topupRequest.amount,
      description: `Wallet top-up approved for ${topupRequest.userName} via ${topupRequest.paymentMode}`,
      referenceType: "TOPUP_REQUEST",
      referenceId: topupRequest._id.toString(),
    });

    await adminTransaction.save({ session });

    // Update topup request status
    topupRequest.status = "approved";
    if (req.user?.id) {
      topupRequest.adminId = new mongoose.Types.ObjectId(req.user.id);
    }
    topupRequest.adminRemarks = adminRemarks;
    topupRequest.resolvedAt = new Date();

    await topupRequest.save({ session });

    await session.commitTransaction();

    return res.status(200).json({
      message: "Top-up approved",
      requestId: topupRequest._id,
      newBalance: adminWallet.balance,
    });
  } catch (error: any) {
    await session.abortTransaction();
    res.status(500).json({ error: error.message });
  } finally {
    session.endSession();
  }
};

// Reject topup request
export const rejectTopupRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { adminRemarks = "" } = req.body;

    const topupRequest = await WalletTopupRequest.findById(id);

    if (!topupRequest) {
      return res.status(404).json({ error: "Top-up request not found" });
    }

    // Check if already resolved
    if (topupRequest.status !== "pending") {
      return res.status(409).json({ 
        error: `Request already ${topupRequest.status}. Cannot reject.` 
      });
    }

    topupRequest.status = "rejected";
    if (req.user?.id) {
      topupRequest.adminId = new mongoose.Types.ObjectId(req.user.id);
    }
    topupRequest.adminRemarks = adminRemarks;
    topupRequest.resolvedAt = new Date();

    await topupRequest.save();

    return res.status(200).json({
      message: "Top-up request rejected",
      requestId: topupRequest._id,
      status: "rejected",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
