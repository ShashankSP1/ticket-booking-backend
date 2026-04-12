import mongoose from "mongoose";

const walletTopupRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userEmail: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    userName: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
      max: 100000,
    },
    paymentMode: {
      type: String,
      enum: ["UPI", "Debit Card", "Credit Card", "Bank Transfer", "Net Banking"],
      required: true,
    },
    receiptUrl: {
      type: String,
      required: false,
    },
    receiptPublicId: {
      type: String,
      required: false,
    },
    declarationAccepted: {
      type: Boolean,
      required: true,
      default: false,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    adminRemarks: {
      type: String,
      required: false,
    },
    resolvedAt: {
      type: Date,
      required: false,
    },
  },
  { timestamps: true }
);

// Create indexes
walletTopupRequestSchema.index({ status: 1, createdAt: -1 });
walletTopupRequestSchema.index({ userEmail: 1, createdAt: -1 });

export default mongoose.model("WalletTopupRequest", walletTopupRequestSchema);
