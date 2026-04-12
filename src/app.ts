import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import adminRoutes from "./routes/admin.routes";
import eventRoutes from "./routes/event.routes";
import bookingRoutes from "./routes/booking.routes";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);     // legacy — kept for backward compat
app.use("/api/user", userRoutes);     // user/signup, user/login
app.use("/api/admin", adminRoutes);   // admin/signup, admin/login
app.use("/api/events", eventRoutes);  // events listing, create, update
app.use("/api/bookings", bookingRoutes); // bookings management

app.get("/", (_req, res) => {
  res.status(200).json({ message: "Ticket booking backend is running" });
});

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

export default app;