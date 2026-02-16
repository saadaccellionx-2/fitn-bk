const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    date: {
      type: String,
      required: true,
    },
    appOpenCount: {
      type: Number,
      default: 0,
    },
    totalVisits: {
      type: Number,
      default: 0,
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

activitySchema.index({ userId: 1, date: 1 }, { unique: true });

const Activity = mongoose.model("Activity", activitySchema);

module.exports = Activity;
