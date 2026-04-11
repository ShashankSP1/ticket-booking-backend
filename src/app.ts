import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import adminRoutes from "./routes/admin.routes";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);   // legacy — kept for backward compat
app.use("/api/user", userRoutes);   // user/signup, user/login
app.use("/api/admin", adminRoutes); // admin/signup, admin/login

app.use("/", (req, res) => {
  res.send("Hello World");
});

export default app;