import jwt from "jsonwebtoken";

const generateToken = (userId: string): string => {
	const secret = process.env.JWT_SECRET;

	if (!secret) {
		throw new Error("JWT_SECRET is not defined");
	}

	return jwt.sign({ id: userId }, secret, { expiresIn: "7d" });
};

export default generateToken;
