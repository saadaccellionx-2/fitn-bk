const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { USER_MODEL } = require("../../models");
const PASSWORD_RESET_TOKEN_MODEL = require("../../models/passwordResetToken.model");
const { hashPassword } = require("../../helpers/user");
const handleError = require("../../utils/errorHandler");
const { sendPasswordResetEmail } = require("../../helpers/email.helper");

/**
 * Generate a cryptographically secure random token
 * @returns {string} Base64URL encoded token
 */
const generateSecureToken = () => {
  // Generate 32 random bytes (256 bits)
  const randomBytes = crypto.randomBytes(32);
  // Convert to base64url (URL-safe base64)
  return randomBytes.toString("base64url");
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
const validatePasswordStrength = (password) => {
  const errors = [];

  if (!password || password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Request password reset - generates token and sends email
 */
const REQUEST_PASSWORD_RESET = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    // Find user by email
    const user = await USER_MODEL.findOne({ email: email.toLowerCase().trim() });

    // Always return success to prevent email enumeration
    // But only send email if user exists
    if (user && !user.isDeleted) {
      // Generate secure token
      const token = generateSecureToken();

      // Hash the token before storing (bcrypt with 12 rounds)
      const tokenHash = await bcrypt.hash(token, 12);

      // Set expiry to 12 hours from now
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 12);

      // Delete any existing tokens for this user (cleanup - only one active token per user)
      await PASSWORD_RESET_TOKEN_MODEL.deleteMany({
        userId: user._id,
      });

      // Store token hash in database
      await PASSWORD_RESET_TOKEN_MODEL.create({
        userId: user._id,
        tokenHash,
        expiresAt,
      });

      // Build reset URL (token only, no userId) - using open subdomain
      const resetUrlBase =
        process.env.RESET_URL_BASE || "http://localhost:3000";
      const resetUrl = `${resetUrlBase}/auth/reset?token=${encodeURIComponent(
        token
      )}`;

      // Send email (don't await - fire and forget for faster response)
      sendPasswordResetEmail({
        to: user.email,
        resetUrl,
        userName: user.name || user.email,
      }).catch((error) => {
        console.error("Failed to send password reset email:", error);
        // Don't throw - we've already returned success to user
      });
    }

    // Always return the same success message regardless of whether user exists
    return res.status(200).json({
      message:
        "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("Password reset request error:", error);
    // Still return success to prevent information leakage
    return res.status(200).json({
      message:
        "If an account with that email exists, a password reset link has been sent.",
    });
  }
};

/**
 * Reset password using token (token-only, no userId required)
 */
const RESET_PASSWORD = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        message: "Token and new password are required",
      });
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        message: "Password does not meet requirements",
        errors: passwordValidation.errors,
      });
    }

    // Find all non-expired tokens (tokens are deleted after use, so no need to check used: false)
    const tokens = await PASSWORD_RESET_TOKEN_MODEL.find({
      expiresAt: { $gt: new Date() }, // Not expired
    });

    if (tokens.length === 0) {
      return res.status(400).json({
        message: "Invalid or expired reset link",
        errorType: "TOKEN_NOT_FOUND",
      });
    }

    // Try to match the provided token against stored hashes
    let matchedToken = null;
    for (const storedToken of tokens) {
      const isMatch = await bcrypt.compare(token, storedToken.tokenHash);
      if (isMatch) {
        matchedToken = storedToken;
        break;
      }
    }

    if (!matchedToken) {
      return res.status(400).json({
        message: "Invalid reset link",
        errorType: "INVALID_TOKEN",
      });
    }

    // Check if token is expired (double-check)
    if (matchedToken.expiresAt < new Date()) {
      return res.status(400).json({
        message: "Reset link has expired",
        errorType: "TOKEN_EXPIRED",
      });
    }

    // Extract userId from matched token
    const userId = matchedToken.userId;

    // Find user by userId from token
    const user = await USER_MODEL.findById(userId);
    if (!user || user.isDeleted) {
      return res.status(404).json({
        message: "Invalid reset link. Please request a new password reset.",
      });
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update user password
    await USER_MODEL.findByIdAndUpdate(userId, {
      password: hashedPassword,
    });

    // Delete the token after successful reset (one-time use)
    await PASSWORD_RESET_TOKEN_MODEL.findByIdAndDelete(matchedToken._id);

    // Delete all other unused tokens for this user (cleanup)
    await PASSWORD_RESET_TOKEN_MODEL.deleteMany({
      userId: userId,
      _id: { $ne: matchedToken._id },
    });

    // Send confirmation email (don't await - fire and forget)
    const { sendPasswordResetConfirmationEmail } = require("../../helpers/email.helper");
    sendPasswordResetConfirmationEmail({
      to: user.email,
      userName: user.name || user.email,
    }).catch((error) => {
      console.error("Failed to send password reset confirmation email:", error);
      // Don't throw - password reset was successful
    });

    return res.status(200).json({
      message: "Password reset successfully",
    });
  } catch (error) {
    return handleError(error, res);
  }
};

module.exports = {
  REQUEST_PASSWORD_RESET,
  RESET_PASSWORD,
};

