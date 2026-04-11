import { Request, Response } from "express";
import bcrypt from "bcrypt";
import User from "../shared/models/user.model";
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

		const hashedPassword = await bcrypt.hash(password, 10);
		const user = await User.create({
			name,
			email,
			password: hashedPassword,
		});

		const token = generateToken(user._id.toString());

		res.status(201).json({
			message: "User registered successfully",
			token,
			user: {
				id: user._id,
				name: user.name,
				email: user.email,
				role: user.role,
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

		const token = generateToken(user._id.toString());

		res.status(200).json({
			message: "Login successful",
			token,
			user: {
				id: user._id,
				name: user.name,
				email: user.email,
				role: user.role,
			},
		});
	} catch (error) {
		res.status(500).json({ message: "Server error", error });
	}
};
