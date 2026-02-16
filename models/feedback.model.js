// models/Feedback.js
const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  ratingPoints: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  message: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: new Date(),
  },
});

const Feedback = mongoose.model("Feedback", feedbackSchema);
module.exports = Feedback;
