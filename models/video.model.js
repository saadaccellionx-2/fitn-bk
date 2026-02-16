const mongoose = require("mongoose");

const videosSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  thumbnailUrl: {
    type: String,
  },
  url: {
    type: String,
  },
  originalUrl: {
    type: String,
  },

  caption: {
    type: String,
  },

  isPrivate: {
    type: Boolean,
    default: false,
  },

  isDeleted: {
    type: Boolean,
    default: false,
  },

  isFeatured: {
    type: Boolean,
    default: false,
  },
  // createdAt: {
  //   type: Date,
  //   default: new Date(),
  // },
  // updatedAt: {
  //   type: Date,
  //   default: new Date(),
  // },
  owner: {
    type: mongoose.Schema.ObjectId,
    ref: "users",
  },

  viewCount: {
    type: Number,
    default: 0,
  },

  sponsored: {
    type: Boolean,
    default: false,
  },

  s3BucketId: {
    type: String,
  },
  originalS3BucketId: {
    type: String,
  },
  likes: {
    type: [String],
    default: [],
  },

  category: {
    type: mongoose.Schema.ObjectId,
    ref: "category",
  },
  tags: {
    type: [String], // Assuming each tag is a string
    default: [],
  },
},{
  timestamps: true,
});

const VIDEOS = mongoose.model("videos", videosSchema);
module.exports = VIDEOS;
