const jwt = require("jsonwebtoken");
const User = require("../models/User");

/* ================= AUTH ================= */
const authMiddleware = async (req, res, next) => {
  try {

    // ✅ accept cookie OR bearer token
    let token =
      req.cookies?.token ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    );

    const user = await User.findOne({ userId: decoded.userId });

    if (!user) {
      return res.status(401).json({ message: "Invalid user" });
    }

    req.user = user;
    next();

  } catch (err) {
    console.error("Auth error:", err.message);
    res.status(401).json({ message: "Please authenticate" });
  }
};

/* ================= ADMIN ================= */
const adminMiddleware = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

module.exports = {
  authMiddleware,
  adminMiddleware
};