const mongoose = require("mongoose");

const videoViewsSchema = new mongoose.Schema({
  video: {
    type: mongoose.Schema.ObjectId,
    ref: "videos",
    required: true,
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: "users",
    required: true,
  },
  viewedAt: {
    type: Date,
    default: Date.now,
  },
});

// Create a compound index for uniqueness and query performance
videoViewsSchema.index({ video: 1, user: 1 }, { unique: true });

const VIDEOVIEWS = mongoose.model("videoViews", videoViewsSchema);

module.exports = VIDEOVIEWS;
