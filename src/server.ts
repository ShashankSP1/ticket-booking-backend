import app from "./app";
import mongoose from "mongoose";
import { startReservationExpiryJob } from "./jobs/expireReservations";

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  throw new Error("MONGO_URI is not defined");
}

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");
    startReservationExpiryJob();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => console.log(err));