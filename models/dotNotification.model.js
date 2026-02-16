const mongoose = require("mongoose");

const dotNotificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["video", "bug_report"],
    required: true,
  },
  video: {
    type: mongoose.Schema.ObjectId,
    ref: "videos",
    required: false,
  },
  bugReport: {
    type: mongoose.Schema.ObjectId,
    ref: "bug_reports",
    required: false,
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: "users",
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const DOT_NOTIFICATION = mongoose.model("dotNotifications", dotNotificationSchema);
module.exports = DOT_NOTIFICATION;