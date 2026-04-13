import mongoose from "mongoose";

const reservationSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    seatNumbers: {
      type: [String],
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

reservationSchema.index({ expiresAt: 1 });
reservationSchema.index({ userId: 1 });

export default mongoose.model("Reservation", reservationSchema);
