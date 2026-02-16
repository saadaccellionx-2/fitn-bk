const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  title: {
    type: String,
  },
  body: {
    type: String,
  },
  status: {
    type: String,
    enum: ["unread", "read"],
    default: "unread",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  additionalData: {
    type: {
      type: String, // Notification type (e.g., 'video', 'playlist')
    },
    imageUrl: {
      type: String, // Notification type (e.g., 'video', 'playlist')
    },
    id: {
      type: mongoose.Schema.Types.ObjectId, // ID of the related item (e.g., videoId, playlistId)
      required: false,
    },
  },
});

const NOTIFICATION = mongoose.model("notifications", notificationSchema);
module.exports = NOTIFICATION;
