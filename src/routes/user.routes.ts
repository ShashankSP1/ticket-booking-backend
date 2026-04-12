import { Router, Response } from "express";
import { registerUser, loginUserOnly } from "../controllers/auth.controller";
import { protect } from "../middleware/auth.middleware";
import { AuthenticatedRequest } from "../types/auth.types";
import User from "../shared/models/user.model";

const router = Router();

router.post("/signup", registerUser);
router.post("/register", registerUser);
router.post("/login", loginUserOnly);
router.post("/signin", loginUserOnly);

// Get wallet balance for logged-in user
router.get("/wallet", protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
	try {
		const userId = req.user?.id;
		if (!userId) {
			res.status(401).json({ message: "Not authorized" });
			return;
		}

		const user = await User.findById(userId).select("email walletBalance");
		if (!user) {
			res.status(404).json({ message: "User not found" });
			return;
		}

		res.status(200).json({
			email: user.email,
			walletBalance: user.walletBalance,
		});
	} catch (error) {
		res.status(500).json({ message: "Server error", error });
	}
});

export default router;
