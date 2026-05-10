import "dotenv/config";
import pool from "./config/db";
import app from "./app";
// import { startReservationExpiryJob } from "./jobs/expireReservations";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await pool.query("SELECT NOW()");
    app.listen(PORT, () => {
      console.log(`DB connected. Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("DB Error:", err);
    process.exit(1);
  }
};

startServer();
