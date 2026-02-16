const mongoose = require("mongoose");

const inspirationSchema = new mongoose.Schema(
  {
    tag: {
      type: String,
      default: "",
    },
    videos: {
      type: [
        {
          type: mongoose.Schema.ObjectId,
          ref: "videos",
        },
      ],
      default: [],
    },
    influencer: {
      type: mongoose.Schema.ObjectId,
      ref: "users",
    },
    playlists: {
      type: [
        {
          type: mongoose.Schema.ObjectId,
          ref: "playlists",
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const INSPIRATION = mongoose.model(
  "inspiration",
  inspirationSchema
);
module.exports = INSPIRATION;

