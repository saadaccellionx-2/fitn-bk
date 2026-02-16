const mongoose = require("mongoose");

const adminNotificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ["videos", "users", "playlists", "video_reports", "comment_reports", "form_submission"],
      required: true,
    },

    relatedItem: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      refPath: "type",
    },

    status: {
      type: String,
      enum: ["unread", "read"],
      default: "unread",
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const ADMIN_NOTIFICATION = mongoose.model(
  "admin_Notification",
  adminNotificationSchema
);
module.exports = ADMIN_NOTIFICATION;
