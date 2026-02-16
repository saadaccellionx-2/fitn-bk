const mongoose = require("mongoose");

const notificationPreferencesSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    preferences: {
      newVideo: {
        type: Boolean,
        default: true,
      },
      newPlaylist: {
        type: Boolean,
        default: true,
      },
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

notificationPreferencesSchema.index(
  { userId: 1, targetUserId: 1 },
  { unique: true }
);

notificationPreferencesSchema.index({
  targetUserId: 1,
  "preferences.newVideo": 1,
});
notificationPreferencesSchema.index({
  targetUserId: 1,
  "preferences.newPlaylist": 1,
});

const NotificationPreferences = mongoose.model(
  "notificationPreferences",
  notificationPreferencesSchema
);

module.exports = NotificationPreferences;
