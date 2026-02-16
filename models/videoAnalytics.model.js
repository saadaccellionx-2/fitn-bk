const mongoose = require("mongoose");

const videoLikeSchema = new mongoose.Schema({
  video: { type: mongoose.Schema.ObjectId, ref: "videos", required: true },
  user: { type: mongoose.Schema.ObjectId, ref: "users", required: true },
  date: { type: Date, default: Date.now },
});
videoLikeSchema.index({ video: 1, user: 1 }, { unique: true });
const VideoLike = mongoose.model("VideoLike", videoLikeSchema);

const videoImpressionSchema = new mongoose.Schema({
  video: { type: mongoose.Schema.ObjectId, ref: "videos", required: true },
  user: { type: mongoose.Schema.ObjectId, ref: "users" },
  date: { type: Date, default: Date.now },
});
videoImpressionSchema.index({ video: 1, date: 1 });
const VideoImpression = mongoose.model(
  "VideoImpression",
  videoImpressionSchema
);

const videoWatchTimeSchema = new mongoose.Schema({
  video: { type: mongoose.Schema.ObjectId, ref: "videos", required: true },
  user: { type: mongoose.Schema.ObjectId, ref: "users" },
  date: { type: Date, default: Date.now },
  duration: { type: Number, required: true, min: 0 },
});
videoWatchTimeSchema.index({ video: 1, date: 1 });
const VideoWatchTime = mongoose.model("VideoWatchTime", videoWatchTimeSchema);

module.exports = { VideoLike, VideoImpression, VideoWatchTime };
