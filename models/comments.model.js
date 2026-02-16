const mongoose = require("mongoose");

const commentsSchema = new mongoose.Schema({
  videoId: {
    type: mongoose.Schema.ObjectId,
    ref: "videos",
    required: true,
    index: true, // Add index for better query performance
  },
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: "users",
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  likes: [
    {
      type: mongoose.Schema.ObjectId,
      ref: "users",
    },
  ],
  likesCount: {
    type: Number,
    default: 0,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});
const COMMENTS = mongoose.model("comments", commentsSchema);
module.exports = COMMENTS;
