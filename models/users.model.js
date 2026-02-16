const mongoose = require("mongoose");

const usersSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  lastName: {
    type: String,
  },
  phone: {
    type: String,
  },
  city: {
    type: String,
  },
  address: {
    type: String,
  },
  username: {
    type: String,
  },
  dob: {
    type: String,
  },
  gender: {
    type: String,
    enum: ["Male", "Female", ""],
  },
  bio: {
    type: String,
    default: "",
  },

  email: {
    type: String,
    required: true,
  },
  connectyCubeId: {
    type: String,
  },

  emailVerified: {
    type: Boolean,
    default: false, // Default to false as email is not verified upon creation
  },
  password: {
    type: String,
    required: true, // Ensures a password is provided
    default: "abc",
  },

  profilePic: {
    type: String,
    default: "",
  },

  coverImage: {
    type: String,
    default: "",
  },

  isVerified: {
    type: Boolean,
  },
  isFeatured: {
    type: Boolean,
    default: false,
  },
  hasAcceptedTerms: {
  type: Boolean,
  default: false,
  },
  hasAcceptedPrivacyPolicy: {
  type: Boolean,
  default: false,
  },
  accountType: {
    type: String,
  },
  notificationToken: {
    type: String,
  },
  role: {
    type: String,
    enum: ["user", "admin", "influencer"],
    default: "user",
  },
  permissions: {
    type: String,
    enum: ["null", "requested", "approved", "rejected"],
    default: "null",
  },
  onboarding: {
    type: Boolean,
    default: false,
  },
  selectedCategories: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "category",
    },
  ],
  device: {
    type: String,
    enum: ["null", "Apple", "Android"],
    default: "null",
  },
  appState: {
  type: String,
  enum: ["offline", "active", "background", "idle"],
  default: "offline",
},
  refreshToken: {
    type: String,
  },
  pinnedVideos: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "videos",
    },
  ],

  pinnedPlaylists: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "playlists",
    },
  ],

  followers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },
  ],
  following: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },
  ],

  followingPlayLists: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "playlists",
    },
  ],

  blockedUsers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },
  ],

  updatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: "users",
  },

  isDeleted: {
    type: Boolean,
    default: false,
  },

  status: {
    type: {
      status: {
        type: String,
        enum: ["active", "inActive", "suspended5", "suspended30"],
        default: "active",
      },
      suspendedUntil: {
        type: Date,
        required: function () {
          return this.status === "suspended5" || this.status === "suspended30";
        },
      },
    },
    default: {
      status: "active",
    },
  },
  appOpenCount: {
    type: Number,
    default: 0,
  },
},{
  timestamps: true,
});

const USERS = mongoose.model("users", usersSchema);
module.exports = USERS;
