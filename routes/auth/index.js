const express = require("express");
const {
  REQUEST_PASSWORD_RESET,
  RESET_PASSWORD,
} = require("./service");
const {
  passwordResetRequestLimiter,
  passwordResetLimiter,
} = require("../../middleware/rateLimit");

const router = express.Router();

// Request password reset - rate limited to 5 requests per 15 minutes
router.post(
  "/request-password-reset",
  passwordResetRequestLimiter,
  REQUEST_PASSWORD_RESET
);

// Reset password - rate limited to 10 requests per hour
router.post("/reset-password", passwordResetLimiter, RESET_PASSWORD);

module.exports = router;

