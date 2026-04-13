import { Request, Response } from "express";
import bcrypt from "bcrypt";
import User from "../shared/models/user.model";
import Admin from "../shared/models/admin.model";
import generateToken from "../utils/generateToken";

export const registerUser = async (req: Request, res: Response): Promise<void> => {
	try {
		const { name, email, password } = req.body;

		if (!name || !email || !password) {
			res.status(400).json({ message: "Name, email, and password are required" });
			return;
		}

		const existingUser = await User.findOne({ email });
		if (existingUser) {
			res.status(409).json({ message: "User already exists" });
			return;
		}

		const hashedPassword = await bcrypt.hash(password, 12);
		const user = await User.create({
			name,
			email,
			password: hashedPassword,
		});

		const token = generateToken(user._id.toString(), "user");

		res.status(201).json({
			message: "User registered successfully",
			token,
			user: {
				id: user._id,
				name: user.name,
				email: user.email,
				role: user.role,
				walletBalance: user.walletBalance,
			},
		});
	} catch (error) {
		res.status(500).json({ message: "Server error", error });
	}
};

export const loginUser = async (req: Request, res: Response): Promise<void> => {
	try {
		const { email, password } = req.body;

		if (!email || !password) {
			res.status(400).json({ message: "Email and password are required" });
			return;
		}

		const user = await User.findOne({ email });
		if (!user) {
			res.status(401).json({ message: "Invalid credentials" });
			return;
		}

		const isPasswordValid = await bcrypt.compare(password, user.password);
		if (!isPasswordValid) {
			res.status(401).json({ message: "Invalid credentials" });
			return;
		}

		const token = generateToken(user._id.toString(), "user");

		res.status(200).json({
			message: "Login successful",
			token,
			user: {
				id: user._id,
				name: user.name,
				email: user.email,
				role: user.role,
				walletBalance: user.walletBalance,
			},
		});
	} catch (error) {
		res.status(500).json({ message: "Server error", error });
	}
};

// User-only login — rejects admin accounts
export const loginUserOnly = async (req: Request, res: Response): Promise<void> => {
	try {
		const { email, password } = req.body;

		if (!email || !password) {
			res.status(400).json({ message: "Email and password are required" });
			return;
		}

		const user = await User.findOne({ email });
		if (!user) {
			res.status(401).json({ message: "Invalid credentials" });
			return;
		}

		const isPasswordValid = await bcrypt.compare(password, user.password);
		if (!isPasswordValid) {
			res.status(401).json({ message: "Invalid credentials" });
			return;
		}

		if (user.role !== "user") {
			res.status(403).json({ message: "Access denied. Please use the Admin login." });
			return;
		}

		const token = generateToken(user._id.toString(), "user");

		res.status(200).json({
			message: "Login successful",
			token,
			user: {
				id: user._id,
				name: user.name,
				email: user.email,
				role: user.role,
				walletBalance: user.walletBalance,
			},
		});
	} catch (error) {
		res.status(500).json({ message: "Server error", error });
	}
};

// Admin-only login — rejects non-admin accounts
export const loginAdmin = async (req: Request, res: Response): Promise<void> => {
	try {
		const email = req.body?.email ?? req.body?.username ?? req.body?.createdBy;
		const { password } = req.body;

		if (!email || !password) {
			res.status(400).json({ message: "Email and password are required" });
			return;
		}

		const admin = await Admin.findOne({ email });
		if (!admin) {
			res.status(401).json({ message: "Invalid credentials" });
			return;
		}

		const isPasswordValid = await bcrypt.compare(password, admin.password);
		if (!isPasswordValid) {
			res.status(401).json({ message: "Invalid credentials" });
			return;
		}

		const token = generateToken(admin._id.toString(), "admin");

		res.status(200).json({
			message: "Admin login successful",
			token,
			user: {
				id: admin._id,
				name: admin.name,
				email: admin.email,
				role: "admin",
			},
		});
	} catch (error) {
		res.status(500).json({ message: "Server error", error });
	}
};

// Admin signup — protected with ADMIN_SECRET env variable
export const registerAdmin = async (req: Request, res: Response): Promise<void> => {
	try {
		const { name, email, password } = req.body;
		const adminSecret =
			req.body?.adminSecret ?? req.body?.admin_secret ?? req.body?.secretKey;

		if (!name || !email || !password) {
			res.status(400).json({ message: "Name, email, and password are required" });
			return;
		}

		if (!adminSecret) {
			res.status(400).json({
				message:
					"Admin signup requires adminSecret (accepted keys: adminSecret, admin_secret, secretKey)",
			});
			return;
		}

		const expectedAdminSecret = process.env.ADMIN_SECRET;
		if (!expectedAdminSecret) {
			res.status(500).json({ message: "ADMIN_SECRET is not configured on server" });
			return;
		}

		if (String(adminSecret).trim() !== expectedAdminSecret.trim()) {
			res.status(403).json({ message: "Invalid admin secret" });
			return;
		}

		const existingUser = await User.findOne({ email });
		if (existingUser) {
			res.status(409).json({ message: "Email already exists as user" });
			return;
		}

		const existingAdmin = await Admin.findOne({ email });
		if (existingAdmin) {
			res.status(409).json({ message: "Admin already exists" });
			return;
		}

		const hashedPassword = await bcrypt.hash(password, 12);
		const admin = await Admin.create({
			name,
			email,
			password: hashedPassword,
		});

		const token = generateToken(admin._id.toString(), "admin");

		res.status(201).json({
			message: "Admin registered successfully",
			token,
			user: {
				id: admin._id,
				name: admin.name,
				email: admin.email,
				role: "admin",
			},
		});
	} catch (error) {
		res.status(500).json({ message: "Server error", error });
	}
};
