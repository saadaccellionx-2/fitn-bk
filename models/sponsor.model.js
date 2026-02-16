const mongoose = require("mongoose");

const sponsorSchema = new mongoose.Schema({
  brandName: {
    type: String,
    required: true,
  },
  logo: {
    type: String, // URL to the logo image
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  url: {
    type: String, // Website URL
    required: true,
  },

  displayText: {
    type: String,
    default: "Sponsored",
  },
  videoId: {
    type: mongoose.Schema.ObjectId,
    ref: "videos",
  },
  coverImage: {
    type: String, // URL to the cover image
  },

  shopImage: {
    type: String, // URL to the cover image
  },

  followers: [
    {
      type: mongoose.Schema.ObjectId,
      ref: "users",
    },
  ],

  shopText: {
    type: String,
    default: "",
  },

  username: {
    type: String,
    default: "",
  },

  createdAt: {
    type: Date,
    default: new Date(),
  },
  updatedAt: {
    type: Date,
    default: new Date(),
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
});

const SPONSORS = mongoose.model("sponsors", sponsorSchema);
module.exports = SPONSORS;
