import jwt from "jsonwebtoken";
import User from "../Models/userModels.js";

const protectRoute = async (req, res, next) => {
  const token = req.cookies?.jwt;
  if (!token) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }

  if (typeof decoded !== "object" || !decoded || typeof decoded.userId !== "string") {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }

  try {
    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      return res.status(401).json({ success: false, message: "User no longer exists" });
    }

    req.user = user;
    return next();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export default protectRoute;