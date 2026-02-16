const mongoose = require("mongoose");

const sponsorAnalyticsSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: "users",
    required: true,
  },
  sponsor: {
    type: mongoose.Schema.ObjectId,
    ref: "sponsors",
    required: true,
  },
  eventType: {
    type: String,
    enum: ["impression", "profileView", "visitLink", "like"],
    required: true,
  },
  createdAt: {
    type: Date,
    default: () => new Date(),
  },
});

const SPONSOR_ANALYTICS = mongoose.model(
  "sponsor_analytics",
  sponsorAnalyticsSchema
);
module.exports = SPONSOR_ANALYTICS;
