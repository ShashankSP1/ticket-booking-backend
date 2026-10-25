import jwt from "jsonwebtoken";

const generateToken = (userId: string, role: "user" | "admin"): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT SECRET is not defined");
  }

  const expiresIn: jwt.SignOptions["expiresIn"] =
    (process.env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"]) || "10m";

  return jwt.sign({ id: userId, role }, secret, { expiresIn });
};

export default generateToken;
