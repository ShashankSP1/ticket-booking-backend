import mongoose from "mongoose";

const walletTransactionSchema = new mongoose.Schema(
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
    type: {
      type: String,
      enum: ["credit", "debit"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      required: true,
    },
    referenceType: {
      type: String,
      enum: ["TOPUP_REQUEST", "BOOKING", "BOOKING_CANCEL"],
      required: true,
    },
    referenceId: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// Create indexes for efficient queries
walletTransactionSchema.index({ userEmail: 1, createdAt: -1 });

export default mongoose.model("WalletTransaction", walletTransactionSchema);
