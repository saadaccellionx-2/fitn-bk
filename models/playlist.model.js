const mongoose = require("mongoose");

const playlistsSchema = new mongoose.Schema(
  {
    name: {
      type: String,
    },
    imageUrl: {
      type: String,
    },
    shareImageUrl: {
      type: String,
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    videos: {
      type: [{ type: mongoose.Schema.ObjectId, ref: "videos" }],
    },
    followingPlayLists: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "users",
          required: true,
        },
        date: {
          type: Date,
          default: () => new Date(),
        },
      },
    ],
    pinnedVideos: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "videos",
      },
    ],
    owner: {
      type: mongoose.Schema.ObjectId,
      ref: "users",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const PLAYLISTS = mongoose.model("playlists", playlistsSchema);
module.exports = PLAYLISTS;
