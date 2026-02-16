const mongoose = require("mongoose");

const passwordResetTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
      expires: 0, // MongoDB TTL index - auto-delete expired documents
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient lookups
passwordResetTokenSchema.index({ userId: 1, expiresAt: 1 });
passwordResetTokenSchema.index({ tokenHash: 1 });

const PASSWORD_RESET_TOKEN = mongoose.model(
  "passwordResetToken",
  passwordResetTokenSchema
);

module.exports = PASSWORD_RESET_TOKEN;

