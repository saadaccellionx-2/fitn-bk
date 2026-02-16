const { USER_MODEL, ADMIN_MODEL } = require("../models");
const jwt = require("jsonwebtoken");

const protectRoutes = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (token == null) {
      return res.status(401).json({ message: "No token provided" });
    }

    jwt.verify(token, process.env.JWT_SECRET_KEY, async (err, decoded) => {
      if (err) {
        if (err.name === "TokenExpiredError") {
          return res.status(401).json({ message: "Token expired" });
        }
        if (err.name === "JsonWebTokenError") {
          return res.status(401).json({ message: "Invalid token" });
        }
        return res.status(401).json({ message: "Token verification failed" });
      }

      if (!decoded || !decoded._id) {
        return res.status(401).json({ message: "Invalid token payload" });
      }

      const userExist = await USER_MODEL.findOne({ _id: decoded._id });
      if (!userExist) {
        return res.status(401).json({ message: "User not found" });
      }

      if (userExist.isDeleted) {
        return res.status(403).json({ message: "Account disabled" });
      }

      req.user = userExist;
      next();
    });
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({ message: "Authentication failed" });
  }
};

const verifyAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (token == null) return res.sendStatus(401); // Unautorized
    jwt.verify(token, process.env.JWT_SECRET_KEY, async (err, user) => {
      if (err && err.message == "jwt expired") return res.sendStatus(401);
      if (err) return res.sendStatus(401);

      const userExist = await ADMIN_MODEL.findOne({ _id: user._id });
      if (!userExist) return res.sendStatus(401);

      req.user = userExist;
      next();
    });
  } catch (error) {
    res.sendStatus(401);
  }
};

const adminOnly = (req, res, next) => {
  try {
    if (req.user.role === "admin") {
      next();
    } else res.sendStatus(401);
  } catch (error) {
    res.sendStatus(401);
  }
};

module.exports = { protectRoutes, verifyAdmin, adminOnly };
