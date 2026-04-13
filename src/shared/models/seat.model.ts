import mongoose from "mongoose";

const seatSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    seatNumber: {
      type: String,
      required: true,
    },
    row: {
      type: String,
      required: true,
    },
    col: {
      type: Number,
      required: true,
    },
    state: {
      type: String,
      enum: ["available", "reserved", "booked"],
      default: "available",
      index: true,
    },
    reservedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reservedUntil: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Unique constraint: one seat number per event
seatSchema.index({ eventId: 1, seatNumber: 1 }, { unique: true });

export default mongoose.model("Seat", seatSchema);
