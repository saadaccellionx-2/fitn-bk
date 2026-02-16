const rateLimit = require("express-rate-limit");

/**
 * Rate limiter for password reset requests
 * Limits: 5 requests per 15 minutes per IP
 */
const passwordResetRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    message:
      "Too many password reset requests. Please try again after 15 minutes.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Use IP from request (works with proxy)
  keyGenerator: (req) => {
    return (
      req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      "unknown"
    );
  },
});

/**
 * Rate limiter for password reset submissions
 * Limits: 10 requests per hour per IP
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    message:
      "Too many password reset attempts. Please try again after 1 hour.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return (
      req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      "unknown"
    );
  },
});

module.exports = {
  passwordResetRequestLimiter,
  passwordResetLimiter,
};

