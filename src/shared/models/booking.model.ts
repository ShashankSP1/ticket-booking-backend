import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
    },
    eventName: {
      type: String,
      required: true,
    },
    eventDate: {
      type: String,
      required: true,
    },
    eventTime: {
      type: String,
      required: true,
    },
    reservationId: {
      type: String,
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    userEmail: {
      type: String,
      required: true,
    },
    userName: {
      type: String,
      required: true,
    },
    tickets: {
      type: Number,
      required: true,
      min: 1,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    seatNumbers: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["confirmed", "cancelled"],
      default: "confirmed",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }
);

bookingSchema.index({ userEmail: 1, createdAt: -1 });
bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ reservationId: 1 }, { unique: true, sparse: true });

export default mongoose.model("Booking", bookingSchema);
