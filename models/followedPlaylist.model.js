const mongoose = require("mongoose");

const followedPlaylistSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  playlistId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "playlists",
    required: true,
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  followedAt: {
    type: Date,
    default: Date.now,
  },
});

const FollowedPlaylist = mongoose.model(
  "FollowedPlaylist",
  followedPlaylistSchema
);
module.exports = FollowedPlaylist;
