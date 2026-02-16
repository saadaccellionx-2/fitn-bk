const mongoose = require("mongoose");

const videoReportSchema = new mongoose.Schema({
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
  report: {
    detail: {
      type: String,
      required: false,
    },
    reason: {
      type: String,
      required: true,
    },
  },

  createdAt: {
    type: Date,
    default: new Date(),
  },
});

const VideoReport = mongoose.model("video_reports", videoReportSchema);
module.exports = VideoReport;
